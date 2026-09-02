<?php

namespace Tests\Unit\Http\Request\Image;

use HiEvents\DomainObjects\Enums\ImageType;
use HiEvents\Http\Request\Image\CreateImageRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Validator as ValidatorInstance;
use Imagick;
use Tests\TestCase;

class CreateImageRequestTest extends TestCase
{
    private array $tempFiles = [];

    protected function setUp(): void
    {
        parent::setUp();

        if (!extension_loaded('imagick')) {
            $this->markTestSkipped('These tests require Imagick to generate fixture images');
        }
    }

    public function test_gif_is_accepted(): void
    {
        $validator = $this->validateUpload('gif', 'image/gif');

        $this->assertFalse(
            $validator->errors()->has('image'),
            'Expected a GIF to pass validation: ' . $validator->errors()->first('image')
        );
    }

    public function test_previously_supported_formats_are_still_accepted(): void
    {
        $formats = [
            'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
        ];

        foreach ($formats as $extension => $mimeType) {
            $validator = $this->validateUpload($extension, $mimeType);

            $this->assertFalse(
                $validator->errors()->has('image'),
                "Expected a {$extension} to pass validation: " . $validator->errors()->first('image')
            );
        }
    }

    public function test_unsupported_format_is_rejected(): void
    {
        $validator = $this->validateUpload('bmp', 'image/bmp');

        $this->assertTrue($validator->errors()->has('image'));
    }

    private function validateUpload(string $extension, string $mimeType): ValidatorInstance
    {
        [$minWidth, $minHeight] = ImageType::getMinimumDimensionsMap(ImageType::GENERIC);

        $path = $this->createImage($extension, $minWidth, $minHeight);

        return Validator::make(
            ['image' => new UploadedFile($path, 'cover.' . $extension, $mimeType, null, true)],
            (new CreateImageRequest)->rules()
        );
    }

    private function createImage(string $extension, int $width, int $height): string
    {
        $imagick = new Imagick();
        $imagick->newImage($width, $height, '#ff5500');
        $imagick->setImageFormat($extension);

        $path = sys_get_temp_dir() . '/test_upload_' . uniqid() . '.' . $extension;
        $imagick->writeImage($path);
        $imagick->destroy();

        $this->tempFiles[] = $path;

        return $path;
    }

    protected function tearDown(): void
    {
        foreach ($this->tempFiles as $path) {
            if (file_exists($path)) {
                unlink($path);
            }
        }

        parent::tearDown();
    }
}
