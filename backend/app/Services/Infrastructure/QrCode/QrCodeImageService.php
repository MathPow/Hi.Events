<?php

namespace HiEvents\Services\Infrastructure\QrCode;

use BaconQrCode\Common\ErrorCorrectionLevel;
use BaconQrCode\Encoder\ByteMatrix;
use BaconQrCode\Encoder\Encoder;

/**
 * Renders QR codes without relying on any image extension.
 *
 * Bacon's own PNG renderer needs ext-imagick, and dompdf refuses to embed a PNG unless ext-gd is
 * present, neither of which is guaranteed in a deployment image. So we emit the PNG by hand (zlib
 * ships with every PHP build) for emails, and SVG for PDFs, which dompdf draws natively.
 */
class QrCodeImageService
{
    private const DEFAULT_MODULE_SIZE = 8;

    /**
     * The QR spec requires four blank modules around the symbol for scanners to lock on.
     */
    private const QUIET_ZONE_MODULES = 4;

    private const WHITE_PIXEL = "\xff\xff\xff";

    private const BLACK_PIXEL = "\x00\x00\x00";

    /**
     * For email. Most clients will not display an SVG.
     */
    public function renderPng(string $content, int $moduleSize = self::DEFAULT_MODULE_SIZE): string
    {
        $matrix = $this->encode($content);
        $moduleCount = $matrix->getWidth();
        $quietZonePixels = self::QUIET_ZONE_MODULES * $moduleSize;
        $imageSize = $this->imageSize($moduleCount, $moduleSize);

        $quietZoneRow = "\x00" . str_repeat(self::WHITE_PIXEL, $imageSize);
        $quietZoneEdge = str_repeat(self::WHITE_PIXEL, $quietZonePixels);

        $scanlines = str_repeat($quietZoneRow, $quietZonePixels);

        for ($y = 0; $y < $moduleCount; ++$y) {
            // Leading "\x00" is the PNG per-scanline filter type (none).
            $row = "\x00" . $quietZoneEdge;

            for ($x = 0; $x < $moduleCount; ++$x) {
                $row .= str_repeat(
                    $matrix->get($x, $y) === 1 ? self::BLACK_PIXEL : self::WHITE_PIXEL,
                    $moduleSize
                );
            }

            $row .= $quietZoneEdge;

            $scanlines .= str_repeat($row, $moduleSize);
        }

        $scanlines .= str_repeat($quietZoneRow, $quietZonePixels);

        return $this->encodePng($scanlines, $imageSize);
    }

    public function renderPngDataUri(string $content, int $moduleSize = self::DEFAULT_MODULE_SIZE): string
    {
        return 'data:image/png;base64,' . base64_encode($this->renderPng($content, $moduleSize));
    }

    /**
     * For PDFs. dompdf draws SVG through php-svg-lib, so no image extension is involved.
     */
    public function renderSvg(string $content, int $moduleSize = self::DEFAULT_MODULE_SIZE): string
    {
        $matrix = $this->encode($content);
        $moduleCount = $matrix->getWidth();
        $offset = self::QUIET_ZONE_MODULES * $moduleSize;
        $imageSize = $this->imageSize($moduleCount, $moduleSize);

        $rects = '';

        for ($y = 0; $y < $moduleCount; ++$y) {
            $runStart = null;

            for ($x = 0; $x <= $moduleCount; ++$x) {
                $isDark = $x < $moduleCount && $matrix->get($x, $y) === 1;

                if ($isDark && $runStart === null) {
                    $runStart = $x;
                    continue;
                }

                if (!$isDark && $runStart !== null) {
                    // Merge each horizontal run of dark modules into one rect. A QR of a few hundred
                    // modules would otherwise become a few hundred elements.
                    $rects .= sprintf(
                        '<rect x="%d" y="%d" width="%d" height="%d"/>',
                        $offset + ($runStart * $moduleSize),
                        $offset + ($y * $moduleSize),
                        ($x - $runStart) * $moduleSize,
                        $moduleSize,
                    );

                    $runStart = null;
                }
            }
        }

        return sprintf(
            '<svg xmlns="http://www.w3.org/2000/svg" width="%1$d" height="%1$d" '
            . 'shape-rendering="crispEdges"><rect width="%1$d" height="%1$d" fill="#ffffff"/>'
            . '<g fill="#000000">%2$s</g></svg>',
            $imageSize,
            $rects,
        );
    }

    public function renderSvgDataUri(string $content, int $moduleSize = self::DEFAULT_MODULE_SIZE): string
    {
        return 'data:image/svg+xml;base64,' . base64_encode($this->renderSvg($content, $moduleSize));
    }

    private function encode(string $content): ByteMatrix
    {
        return Encoder::encode(
            content: $content,
            ecLevel: ErrorCorrectionLevel::M(),
            // Our payloads are ASCII, so skip the ECI prefix - some hardware scanners choke on it.
            prefixEci: false,
        )->getMatrix();
    }

    private function imageSize(int $moduleCount, int $moduleSize): int
    {
        return ($moduleCount + (2 * self::QUIET_ZONE_MODULES)) * $moduleSize;
    }

    /**
     * 8 bit truecolour, no interlacing, no alpha - the variant every email client can display.
     */
    private function encodePng(string $scanlines, int $imageSize): string
    {
        $header = pack(
            'NNCCCCC',
            $imageSize,
            $imageSize,
            8,   // bit depth
            2,   // colour type: truecolour
            0,   // compression: deflate
            0,   // filter: adaptive
            0,   // interlace: none
        );

        return "\x89PNG\r\n\x1a\n"
            . $this->chunk('IHDR', $header)
            . $this->chunk('IDAT', gzcompress($scanlines, 9))
            . $this->chunk('IEND', '');
    }

    private function chunk(string $type, string $data): string
    {
        return pack('N', strlen($data))
            . $type
            . $data
            . pack('N', crc32($type . $data));
    }
}
