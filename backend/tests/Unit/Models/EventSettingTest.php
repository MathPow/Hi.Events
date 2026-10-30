<?php

namespace Tests\Unit\Models;

use HiEvents\Models\EventSetting;
use Tests\TestCase;

class EventSettingTest extends TestCase
{
    public function testMapCoordinatesStoredAsDecimalsAreReadAsFloats(): void
    {
        $settings = (new EventSetting())->setRawAttributes([
            'location_latitude' => '46.9466108',
            'location_longitude' => '-71.2957563',
        ]);

        $this->assertSame(46.9466108, $settings->location_latitude);
        $this->assertSame(-71.2957563, $settings->location_longitude);
    }
}
