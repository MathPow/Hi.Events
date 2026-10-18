<?php

namespace HiEvents\Services\Infrastructure\Image;

use HiEvents\Services\Infrastructure\Image\DTO\ImageStorageResponseDTO;
use HiEvents\Services\Infrastructure\Image\Exception\CouldNotUploadImageException;
use Illuminate\Config\Repository;
use Illuminate\Filesystem\FilesystemManager;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Psr\Log\LoggerInterface;

class ImageStorageService
{
    private const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

    public function __construct(
        private readonly FilesystemManager $filesystemManager,
        private readonly Repository        $config,
        private readonly LoggerInterface   $logger,
    )
    {
    }

    /**
     * @throws CouldNotUploadImageException
     */
    public function store(UploadedFile $image, string $imageType): ImageStorageResponseDTO
    {
        $filename = Str::slug(pathinfo($image->getClientOriginalName(), PATHINFO_FILENAME))
            . '-' . Str::random(5) . '.' . $this->getSafeExtension($image);

        $disk = $this->config->get('filesystems.public');

        $path = $this->filesystemManager->disk($disk)->putFileAs(
            path: strtolower($imageType),
            file: $image,
            name: $filename,
            options: [
                'visibility' => 'public',
            ],
        );

        if ($path === false) {
            $this->logger->error(__('Could not upload image to :disk. Check :disk is configured correctly', ['disk' => $disk,]), [
                    'filename' => $filename,
                    'original_filename' => $image->getClientOriginalName()
                ]
            );

            throw new CouldNotUploadImageException(__('Could not upload image'));
        }

        return new ImageStorageResponseDTO  (
            filename: $filename,
            disk: $disk,
            path: $path,
            size: $image->getSize(),
            mime_type: $image->getMimeType()
        );
    }

    /**
     * L'extension vient du contenu reellement detecte, jamais du nom envoye.
     * Le serveur choisit le type de reponse d'apres l'extension: une image
     * valide nommee « x.html » serait sinon servie comme une page de notre
     * domaine, avec ses scripts.
     *
     * @throws CouldNotUploadImageException
     */
    private function getSafeExtension(UploadedFile $image): string
    {
        $extension = strtolower((string)$image->guessExtension());

        if (!in_array($extension, self::ALLOWED_EXTENSIONS, true)) {
            throw new CouldNotUploadImageException(__('Could not upload image'));
        }

        return $extension;
    }
}
