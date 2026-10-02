<?php

namespace HiEvents\Services\Infrastructure\Image;

use Illuminate\Http\UploadedFile;
use Imagick;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Reduit les images televersees avant stockage: on accepte les photos de
 * telephone telles quelles (plusieurs Mo, 4000+ px) et on ne garde qu'une
 * version a la taille ou elle sera reellement affichee.
 */
class ImageOptimizationService
{
    public const MAX_DIMENSION = 2560;

    private const QUALITY = 82;

    // Un PNG opaque au-dela de ce poids est une photo, pas un logo: le JPEG
    // le divise par 5 a 10 sans perte visible.
    private const OPAQUE_PNG_TO_JPEG_THRESHOLD_BYTES = 1024 * 1024;

    public function __construct(
        private readonly LoggerInterface $logger,
    )
    {
    }

    public function optimize(UploadedFile $image): UploadedFile
    {
        if (!extension_loaded('imagick') || !class_exists(Imagick::class)) {
            return $image;
        }

        $imagick = new Imagick();

        try {
            $format = strtolower((string)$image->guessExtension());

            // Les GIF animes perdraient leur animation, et les reechantillonner
            // frame par frame coute des secondes: on les garde tels quels.
            if ($format === 'gif') {
                return $image;
            }

            if ($format === 'jpg' || $format === 'jpeg') {
                // libjpeg decode directement a une taille reduite: une photo de
                // 48 Mpx ne passe jamais en memoire a pleine resolution.
                $imagick->setOption('jpeg:size', (self::MAX_DIMENSION * 2) . 'x' . (self::MAX_DIMENSION * 2));
            }

            $imagick->readImage($image->getRealPath());
            $imagick->autoOrient();

            $resized = $this->resizeToFit($imagick);
            $outputFormat = $this->chooseOutputFormat($imagick, $format, $image->getSize());

            $this->stripMetadataKeepingColourProfile($imagick);

            $imagick->setImageFormat($outputFormat);
            if ($outputFormat === 'jpeg') {
                $imagick->setImageBackgroundColor('white');
                $imagick = $imagick->mergeImageLayers(Imagick::LAYERMETHOD_FLATTEN);
                $imagick->setImageCompressionQuality(self::QUALITY);
                $imagick->setInterlaceScheme(Imagick::INTERLACE_PLANE);
            } elseif ($outputFormat === 'webp') {
                $imagick->setImageCompressionQuality(self::QUALITY);
            } else {
                $imagick->setOption('png:compression-level', '9');
            }

            $blob = $imagick->getImageBlob();

            $formatChanged = $outputFormat !== $this->normaliseFormat($format);
            if (!$resized && !$formatChanged && strlen($blob) >= $image->getSize()) {
                return $image;
            }

            return $this->toUploadedFile($blob, $image, $outputFormat);
        } catch (Throwable $e) {
            $this->logger->warning('Image optimization failed, storing original: ' . $e->getMessage(), [
                'original_filename' => $image->getClientOriginalName(),
            ]);

            return $image;
        } finally {
            $imagick->clear();
        }
    }

    private function resizeToFit(Imagick $imagick): bool
    {
        $width = $imagick->getImageWidth();
        $height = $imagick->getImageHeight();

        if ($width <= self::MAX_DIMENSION && $height <= self::MAX_DIMENSION) {
            return false;
        }

        $imagick->resizeImage(self::MAX_DIMENSION, self::MAX_DIMENSION, Imagick::FILTER_LANCZOS, 1, true);

        return true;
    }

    private function chooseOutputFormat(Imagick $imagick, string $format, int $originalSize): string
    {
        $format = $this->normaliseFormat($format);

        if ($format === 'png'
            && $originalSize > self::OPAQUE_PNG_TO_JPEG_THRESHOLD_BYTES
            && !$this->hasTransparency($imagick)) {
            return 'jpeg';
        }

        return $format;
    }

    private function hasTransparency(Imagick $imagick): bool
    {
        if (!$imagick->getImageAlphaChannel()) {
            return false;
        }

        // Beaucoup de PNG declarent un canal alpha entierement opaque.
        return $imagick->getImageChannelRange(Imagick::CHANNEL_ALPHA)['minima'] < Imagick::getQuantum();
    }

    private function stripMetadataKeepingColourProfile(Imagick $imagick): void
    {
        // Le profil ICC fait le rendu des couleurs (Display P3 des iPhone):
        // sans lui la photo ternit. Le reste (EXIF, GPS) part.
        $profiles = $imagick->getImageProfiles('icc', true);

        $imagick->stripImage();

        if (isset($profiles['icc'])) {
            $imagick->profileImage('icc', $profiles['icc']);
        }
    }

    private function normaliseFormat(string $format): string
    {
        return $format === 'jpg' ? 'jpeg' : $format;
    }

    private function toUploadedFile(string $blob, UploadedFile $original, string $outputFormat): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'img');
        file_put_contents($path, $blob);

        $extension = $outputFormat === 'jpeg' ? 'jpg' : $outputFormat;
        $baseName = pathinfo($original->getClientOriginalName(), PATHINFO_FILENAME);

        return new UploadedFile(
            path: $path,
            originalName: $baseName . '.' . $extension,
            mimeType: 'image/' . $outputFormat,
            error: UPLOAD_ERR_OK,
            test: true,
        );
    }
}
