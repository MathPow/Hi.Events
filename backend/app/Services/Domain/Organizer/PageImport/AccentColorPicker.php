<?php

namespace HiEvents\Services\Domain\Organizer\PageImport;

use Imagick;
use ImagickPixel;
use Throwable;

/**
 * La couleur d'accent de « Ma page » : celle que le site declare (theme-color)
 * si elle est franche, sinon la couleur vive la plus presente dans le logo.
 * Ni gris, ni presque blanc, ni presque noir : elle colore des boutons.
 */
class AccentColorPicker
{
    public function pick(?string $themeColor, ?string $logoBytes): ?string
    {
        if ($themeColor !== null && $this->isVivid($themeColor)) {
            return $themeColor;
        }

        return $logoBytes !== null ? $this->fromImage($logoBytes) : null;
    }

    public function isVivid(string $hex): bool
    {
        [$hue, $saturation, $lightness] = $this->hsl($hex);

        return $saturation >= 0.45 && $lightness >= 0.2 && $lightness <= 0.75;
    }

    private function fromImage(string $bytes): ?string
    {
        try {
            $image = new Imagick();
            $image->readImageBlob($bytes);
            $image->setIteratorIndex(0);
            $image->setImageBackgroundColor(new ImagickPixel('white'));
            $image = $image->mergeImageLayers(Imagick::LAYERMETHOD_FLATTEN);
            $image->thumbnailImage(64, 64, true);
            $image->transformImageColorspace(Imagick::COLORSPACE_SRGB);
            $image->quantizeImage(8, Imagick::COLORSPACE_SRGB, 0, false, false);

            $colors = [];
            foreach ($image->getImageHistogram() as $pixel) {
                $rgb = $pixel->getColor();
                $hex = sprintf('#%02X%02X%02X', $rgb['r'], $rgb['g'], $rgb['b']);
                $colors[$hex] = ($colors[$hex] ?? 0) + $pixel->getColorCount();
            }
            $image->clear();
        } catch (Throwable) {
            return null;
        }

        arsort($colors);
        foreach (array_keys($colors) as $hex) {
            if ($this->isVivid($hex)) {
                return $hex;
            }
        }

        return null;
    }

    /** @return array{float, float, float} teinte en degres, saturation et luminosite de 0 a 1 */
    private function hsl(string $hex): array
    {
        [$r, $g, $b] = array_map(fn($pair) => hexdec($pair) / 255, str_split(ltrim($hex, '#'), 2));
        $max = max($r, $g, $b);
        $min = min($r, $g, $b);
        $lightness = ($max + $min) / 2;
        $delta = $max - $min;

        if ($delta == 0) {
            return [0.0, 0.0, $lightness];
        }

        $saturation = $delta / (1 - abs(2 * $lightness - 1));
        $hue = match ($max) {
            $r => 60 * fmod(($g - $b) / $delta, 6),
            $g => 60 * (($b - $r) / $delta + 2),
            default => 60 * (($r - $g) / $delta + 4),
        };

        return [$hue, $saturation, $lightness];
    }
}
