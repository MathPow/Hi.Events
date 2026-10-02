<?php

namespace Tests\Unit\Services\Infrastructure\Image;

use HiEvents\Services\Infrastructure\Image\ImageOptimizationService;
use Illuminate\Http\UploadedFile;
use Imagick;
use ImagickPixel;
use Psr\Log\NullLogger;
use Tests\TestCase;

class ImageOptimizationServiceTest extends TestCase
{
    private ImageOptimizationService $service;

    private array $tempFiles = [];

    protected function setUp(): void
    {
        parent::setUp();

        if (!extension_loaded('imagick')) {
            $this->markTestSkipped('Imagick is not installed');
        }

        $this->service = new ImageOptimizationService(new NullLogger());
    }

    protected function tearDown(): void
    {
        foreach ($this->tempFiles as $file) {
            @unlink($file);
        }

        parent::tearDown();
    }

    public function testLargeJpegIsDownscaledAndStripped(): void
    {
        $upload = $this->makeImage(5000, 3000, 'jpeg', withExif: true);

        $result = $this->service->optimize($upload);
        $this->tempFiles[] = $result->getRealPath();

        $output = new Imagick($result->getRealPath());
        $this->assertNotSame($upload, $result);
        $this->assertSame(ImageOptimizationService::MAX_DIMENSION, $output->getImageWidth());
        $this->assertSame(1536, $output->getImageHeight());
        $this->assertSame('JPEG', $output->getImageFormat());
        $this->assertSame([], $output->getImageProperties('exif:*'));
        $this->assertSame('photo.jpg', $result->getClientOriginalName());
    }

    public function testSmallImageThatWouldNotShrinkIsKeptAsIs(): void
    {
        $upload = $this->makeImage(800, 400, 'jpeg', quality: 40);

        $this->assertSame($upload, $this->service->optimize($upload));
    }

    public function testTransparentPngStaysPng(): void
    {
        $upload = $this->makeImage(3000, 3000, 'png', transparent: true);

        $result = $this->service->optimize($upload);
        $this->tempFiles[] = $result->getRealPath();

        $output = new Imagick($result->getRealPath());
        $this->assertSame('PNG', $output->getImageFormat());
        $this->assertSame(ImageOptimizationService::MAX_DIMENSION, $output->getImageWidth());
    }

    public function testLargeOpaquePngBecomesJpeg(): void
    {
        $upload = $this->makeImage(3000, 2000, 'png', noise: true);
        $this->assertGreaterThan(1024 * 1024, $upload->getSize());

        $result = $this->service->optimize($upload);
        $this->tempFiles[] = $result->getRealPath();

        $this->assertSame('photo.jpg', $result->getClientOriginalName());
        $this->assertSame('JPEG', (new Imagick($result->getRealPath()))->getImageFormat());
        $this->assertLessThan($upload->getSize(), $result->getSize());
    }

    public function testGifIsNeverTouched(): void
    {
        $upload = $this->makeImage(3000, 3000, 'gif');

        $this->assertSame($upload, $this->service->optimize($upload));
    }

    private function makeImage(
        int    $width,
        int    $height,
        string $format,
        bool   $transparent = false,
        bool   $noise = false,
        bool   $withExif = false,
        int    $quality = 95,
    ): UploadedFile
    {
        $imagick = new Imagick();
        $imagick->newImage($width, $height, new ImagickPixel($transparent ? 'transparent' : '#3366cc'));
        if ($noise || $withExif) {
            $imagick->addNoiseImage(Imagick::NOISE_GAUSSIAN);
        }
        if ($transparent) {
            $imagick->drawImage($this->circle($width, $height));
        }
        $imagick->setImageFormat($format);
        $imagick->setImageCompressionQuality($quality);
        if ($withExif) {
            $imagick->setImageProperty('exif:GPSLatitude', '45/1, 30/1, 0/1');
            $imagick->setImageProperty('comment', 'secret');
        }

        $extension = $format === 'jpeg' ? 'jpg' : $format;
        $path = tempnam(sys_get_temp_dir(), 'imgtest') . '.' . $extension;
        $imagick->writeImage($path);
        $this->tempFiles[] = $path;

        return new UploadedFile($path, 'photo.' . $extension, 'image/' . $format, null, true);
    }

    private function circle(int $width, int $height): \ImagickDraw
    {
        $draw = new \ImagickDraw();
        $draw->setFillColor(new ImagickPixel('#ff0000'));
        $draw->circle($width / 2, $height / 2, $width / 2, $height / 4);

        return $draw;
    }
}
