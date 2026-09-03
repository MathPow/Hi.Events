<?php

namespace Tests\Unit\Services\Infrastructure\QrCode;

use HiEvents\Services\Infrastructure\QrCode\QrCodeImageService;
use Tests\TestCase;

class QrCodeImageServiceTest extends TestCase
{
    private QrCodeImageService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new QrCodeImageService();
    }

    public function test_it_renders_a_valid_png(): void
    {
        $png = $this->service->renderPng('A-K3M9XQ2');

        $this->assertStringStartsWith("\x89PNG\r\n\x1a\n", $png);

        $info = getimagesizefromstring($png);

        $this->assertNotFalse($info, 'The rendered bytes are not a readable image');
        $this->assertSame(IMAGETYPE_PNG, $info[2]);
        $this->assertSame(8, $info['bits']);
        $this->assertSame($info[0], $info[1], 'A QR code must be square');
    }

    public function test_it_scales_with_the_module_size(): void
    {
        $small = getimagesizefromstring($this->service->renderPng('A-K3M9XQ2', 4));
        $large = getimagesizefromstring($this->service->renderPng('A-K3M9XQ2', 8));

        $this->assertSame($small[0] * 2, $large[0]);
    }

    public function test_it_leaves_the_required_quiet_zone(): void
    {
        // Four blank modules on every side, or scanners cannot lock onto the symbol.
        $moduleSize = 5;
        $png = $this->service->renderPng('A-K3M9XQ2', $moduleSize);
        $width = getimagesizefromstring($png)[0];

        $this->assertSame(0, $width % $moduleSize);

        $modulesIncludingQuietZone = $width / $moduleSize;
        // Symbol versions are 21, 25, 29 ... modules wide, always 4n + 17.
        $symbolModules = $modulesIncludingQuietZone - 8;

        $this->assertGreaterThanOrEqual(21, $symbolModules);
        $this->assertSame(0, ($symbolModules - 17) % 4);
    }

    public function test_longer_content_produces_a_larger_symbol(): void
    {
        $short = getimagesizefromstring($this->service->renderPng('A-K3M9XQ2'))[0];
        $long = getimagesizefromstring($this->service->renderPng(str_repeat('A-K3M9XQ2', 20)))[0];

        $this->assertGreaterThan($short, $long);
    }

    public function test_it_renders_a_data_uri(): void
    {
        $dataUri = $this->service->renderPngDataUri('A-K3M9XQ2');

        $this->assertStringStartsWith('data:image/png;base64,', $dataUri);

        $decoded = base64_decode(substr($dataUri, strlen('data:image/png;base64,')), true);

        $this->assertSame($this->service->renderPng('A-K3M9XQ2'), $decoded);
    }
}
