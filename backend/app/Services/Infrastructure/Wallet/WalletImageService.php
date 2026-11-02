<?php

declare(strict_types=1);

namespace HiEvents\Services\Infrastructure\Wallet;

use HiEvents\DomainObjects\ImageDomainObject;
use HiEvents\Helper\Url;
use Illuminate\Config\Repository;
use Illuminate\Filesystem\FilesystemManager;
use Imagick;
use ImagickPixel;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * The organizer's logo and the event's cover as the PNGs the wallets want (covers are often WebP):
 * in the .pkpass for Apple, on the public disk for Google, which fetches them by URL.
 * An image that cannot be read is left out, never blocks the pass.
 */
class WalletImageService
{
    private const VERSION = 'v1';
    private const LOGO_BACKGROUND = '#fffcf8';

    public function __construct(
        private readonly FilesystemManager $filesystemManager,
        private readonly Repository        $config,
        private readonly LoggerInterface   $logger,
    )
    {
    }

    /** The image cropped to fill the box (covers). */
    public function cover(?ImageDomainObject $image, int $width, int $height): ?string
    {
        return $this->render($image, function (Imagick $imagick) use ($width, $height) {
            $imagick->cropThumbnailImage($width, $height);
            $imagick->setImagePage(0, 0, 0, 0);
            $imagick->setImageBackgroundColor(new ImagickPixel(self::LOGO_BACKGROUND));
            $imagick->setImageAlphaChannel(Imagick::ALPHACHANNEL_REMOVE);
        }, 'png24');
    }

    /** The whole image, as large as fits in the box, transparent around (logos). */
    public function contain(?ImageDomainObject $image, int $width, int $height): ?string
    {
        return $this->render($image, fn(Imagick $imagick) => $imagick->thumbnailImage($width, $height, true), 'png32');
    }

    /** Width / height, to know whether the organizer's name fits beside the logo. */
    public function aspectRatio(?ImageDomainObject $image): ?float
    {
        $bytes = $this->read($image);
        if ($bytes === null) {
            return null;
        }

        try {
            $size = getimagesizefromstring($bytes);
            if ($size !== false && $size[1] > 0) {
                return $size[0] / $size[1];
            }

            $imagick = $this->load($bytes);

            return $imagick->getImageWidth() / max(1, $imagick->getImageHeight());
        } catch (Throwable) {
            return null;
        }
    }

    /** The Dehors symbol, square: the icon of every pass. */
    public function platformIcon(int $size): string
    {
        $imagick = new Imagick(resource_path('wallet/dehors-icon.png'));
        $imagick->thumbnailImage($size, $size, true);
        $imagick->setImageFormat('png32');

        return $imagick->getImageBlob();
    }

    /**
     * Google's logo: square and masked in a circle, so the logo sits small in the middle, on the
     * cream of the pages. Without a logo, the Dehors symbol.
     */
    public function publicCircleLogoUrl(?ImageDomainObject $image): ?string
    {
        $name = $image ? $image->getId() . '-logo' : 'dehors-logo';

        return $this->publicUrl($name, function () use ($image) {
            $logo = $image ? $this->contain($image, 440, 440) : null;
            $logo ??= $this->platformIcon(440);

            $canvas = new Imagick();
            $canvas->newImage(660, 660, new ImagickPixel(self::LOGO_BACKGROUND), 'png32');
            $mark = new Imagick();
            $mark->readImageBlob($logo);
            $canvas->compositeImage(
                $mark,
                Imagick::COMPOSITE_OVER,
                intdiv(660 - $mark->getImageWidth(), 2),
                intdiv(660 - $mark->getImageHeight(), 2),
            );

            return $canvas->getImageBlob();
        });
    }

    public function publicCoverUrl(?ImageDomainObject $image, int $width, int $height): ?string
    {
        if ($image === null) {
            return null;
        }

        return $this->publicUrl(
            $image->getId() . "-cover-{$width}x$height",
            fn() => $this->cover($image, $width, $height),
        );
    }

    /** Made once, then served by the public disk like the other images. */
    private function publicUrl(string $name, callable $make): ?string
    {
        $path = 'wallet/' . $name . '-' . self::VERSION . '.png';
        $disk = $this->filesystemManager->disk($this->config->get('filesystems.public'));

        try {
            if (!$disk->exists($path)) {
                $png = $make();
                if ($png === null) {
                    return null;
                }
                $disk->put($path, $png, ['visibility' => 'public']);
            }
        } catch (Throwable $exception) {
            $this->logger->warning('Wallet: the image could not be stored', [
                'path' => $path,
                'exception' => $exception->getMessage(),
            ]);

            return null;
        }

        return Url::getCdnUrl($path);
    }

    private function render(?ImageDomainObject $image, callable $resize, string $format): ?string
    {
        $bytes = $this->read($image);
        if ($bytes === null) {
            return null;
        }

        try {
            $imagick = $this->load($bytes);
            $resize($imagick);
            $imagick->setImageFormat($format);
            $imagick->stripImage();

            return $imagick->getImageBlob();
        } catch (Throwable $exception) {
            $this->logger->warning('Wallet: the image could not be converted', [
                'image_id' => $image?->getId(),
                'exception' => $exception->getMessage(),
            ]);

            return null;
        }
    }

    private function load(string $bytes): Imagick
    {
        $imagick = new Imagick();
        $imagick->readImageBlob($bytes);
        $imagick->setIteratorIndex(0);
        $imagick = $imagick->getImage();

        if ($imagick->getImageColorspace() === Imagick::COLORSPACE_CMYK) {
            $imagick->transformImageColorspace(Imagick::COLORSPACE_SRGB);
        }
        if (method_exists($imagick, 'autoOrient')) {
            $imagick->autoOrient();
        }

        return $imagick;
    }

    private function read(?ImageDomainObject $image): ?string
    {
        if ($image === null || !$image->getPath()) {
            return null;
        }

        try {
            $disk = $this->filesystemManager->disk($image->getDisk() ?: $this->config->get('filesystems.public'));
            $bytes = $disk->get($image->getPath());

            return is_string($bytes) && $bytes !== '' ? $bytes : null;
        } catch (Throwable $exception) {
            $this->logger->warning('Wallet: the image could not be read', [
                'image_id' => $image->getId(),
                'exception' => $exception->getMessage(),
            ]);

            return null;
        }
    }
}
