<?php

namespace Tests\Unit\Services\Domain\Organizer\PageImport;

use HiEvents\Services\Domain\Organizer\PageImport\AccentColorPicker;
use Imagick;
use ImagickPixel;
use Tests\TestCase;

class AccentColorPickerTest extends TestCase
{
    public function testAVividThemeColorIsKept(): void
    {
        $this->assertSame('#1A7F5A', (new AccentColorPicker())->pick('#1A7F5A', null));
    }

    public function testGreysWhitesAndDarksAreNotAccents(): void
    {
        $picker = new AccentColorPicker();

        foreach (['#FFFFFF', '#111111', '#808080', '#F5F0E8', '#856A44'] as $color) {
            $this->assertFalse($picker->isVivid($color), $color);
        }
        $this->assertTrue($picker->isVivid('#FA7853'));
    }

    public function testTheLogoGivesItsMainVividColor(): void
    {
        $logo = new Imagick();
        $logo->newImage(120, 120, new ImagickPixel('#FFFFFF'));
        $orange = new \ImagickDraw();
        $orange->setFillColor(new ImagickPixel('#FA7853'));
        $orange->rectangle(10, 10, 100, 100);
        $logo->drawImage($orange);
        $logo->setImageFormat('png');

        $accent = (new AccentColorPicker())->pick('#FFFFFF', $logo->getImageBlob());

        $this->assertNotNull($accent);
        [$r, $g, $b] = array_map('hexdec', str_split(ltrim($accent, '#'), 2));
        $this->assertEqualsWithDelta(0xFA, $r, 12);
        $this->assertEqualsWithDelta(0x78, $g, 12);
        $this->assertEqualsWithDelta(0x53, $b, 12);
    }
}
