<?php

namespace HiEvents\Services\Domain\Organizer\PageImport;

use HiEvents\Services\Infrastructure\WebPage\SafeWebFetcher;
use HiEvents\Services\Infrastructure\WebPage\UnsafeUrlException;
use HiEvents\Services\Infrastructure\WebPage\WebPageFetchException;

/**
 * Parmi les images d'une page, la premiere qui peut servir de logo ou de
 * couverture : une vraie image (PNG, JPEG, WebP, GIF ; pas de SVG), assez
 * grande pour « Ma page » (les minimums du serveur, ImageType).
 */
class PageImageChooser
{
    public const MAX_BYTES = 15 * 1024 * 1024;

    private const MAX_TRIES = 4;

    private const ALLOWED = [IMAGETYPE_PNG, IMAGETYPE_JPEG, IMAGETYPE_WEBP, IMAGETYPE_GIF];

    public function __construct(
        private readonly SafeWebFetcher $fetcher,
    )
    {
    }

    /** @param list<string> $candidates */
    public function logo(array $candidates): ?ChosenImage
    {
        // Un logo est a peu pres carre ; une banniere ne convient pas.
        return $this->first($candidates, fn(int $width, int $height) => $width >= 100 && $height >= 100 && $width <= $height * 3);
    }

    /** @param list<string> $candidates */
    public function cover(array $candidates): ?ChosenImage
    {
        return $this->first($candidates, fn(int $width, int $height) => $width >= 600 && $height >= 200);
    }

    /**
     * L'image elle-meme, pour le navigateur qui la met dans le brouillon.
     *
     * @throws UnsafeUrlException
     * @throws WebPageFetchException
     */
    public function download(string $url): ChosenImage
    {
        $image = $this->inspect($url);
        if ($image === null) {
            throw new WebPageFetchException(__('This is not an image.'));
        }

        return $image;
    }

    /** @param list<string> $candidates */
    private function first(array $candidates, callable $fits): ?ChosenImage
    {
        foreach (array_slice($candidates, 0, self::MAX_TRIES) as $url) {
            try {
                $image = $this->inspect($url);
            } catch (UnsafeUrlException|WebPageFetchException) {
                continue;
            }
            if ($image !== null && $fits($image->width, $image->height)) {
                return $image;
            }
        }

        return null;
    }

    /**
     * @throws UnsafeUrlException
     * @throws WebPageFetchException
     */
    private function inspect(string $url): ?ChosenImage
    {
        $file = $this->fetcher->fetch($url, self::MAX_BYTES);
        $size = @getimagesizefromstring($file->body);

        if ($size === false || !in_array($size[2], self::ALLOWED, true)) {
            return null;
        }

        return new ChosenImage(
            url: $file->url,
            mimeType: image_type_to_mime_type($size[2]),
            width: $size[0],
            height: $size[1],
            bytes: $file->body,
        );
    }
}
