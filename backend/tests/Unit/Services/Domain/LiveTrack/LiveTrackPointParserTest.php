<?php

namespace Tests\Unit\Services\Domain\LiveTrack;

use HiEvents\Services\Domain\LiveTrack\LiveTrackPointParser;
use Tests\TestCase;

class LiveTrackPointParserTest extends TestCase
{
    private LiveTrackPointParser $parser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->parser = new LiveTrackPointParser();
    }

    public function test_reads_the_position_and_the_watch_figures(): void
    {
        $points = $this->parser->parse(['trackPoints' => [[
            'dateTime' => '2026-11-28T14:05:10.000Z',
            'position' => ['lat' => 46.8139, 'lon' => -71.2080],
            'altitude' => 98.4,
            'speedMetersPerSec' => 3.1,
            'totalDistanceMeters' => 5230.5,
            'totalDurationSecs' => 1802,
            'totalElevationGainMeters' => 64,
            'heartRateBeatsPerMin' => 151,
            'cadenceCyclesPerMin' => 84,
            'activityType' => 'RUNNING',
        ]]]);

        $this->assertCount(1, $points);
        $point = $points[0];
        $this->assertSame('2026-11-28 14:05:10', $point->recordedAt->toDateTimeString());
        $this->assertSame(46.8139, $point->latitude);
        $this->assertSame(-71.208, $point->longitude);
        $this->assertSame(98.4, $point->altitudeM);
        $this->assertSame(3.1, $point->speedMps);
        $this->assertSame(5230.5, $point->distanceM);
        $this->assertSame(1802, $point->durationS);
        $this->assertSame(64.0, $point->elevationGainM);
        $this->assertSame(151, $point->heartRate);
        $this->assertSame(84, $point->cadence);
        $this->assertFalse($point->isEnd);
    }

    public function test_reads_figures_nested_in_fitness_point_data_and_latitude_longitude_names(): void
    {
        $points = $this->parser->parse(['trackPoints' => [[
            'dateTime' => '2026-11-28T14:05:10Z',
            'position' => ['latitude' => 46.8, 'longitude' => -71.2],
            'fitnessPointData' => ['heartRateBeatsPerMin' => 140, 'distanceMeters' => 100, 'eventTypes' => ['END']],
        ]]]);

        $this->assertSame(140, $points[0]->heartRate);
        $this->assertSame(100.0, $points[0]->distanceM);
        $this->assertTrue($points[0]->isEnd);
    }

    public function test_converts_semicircles_to_degrees(): void
    {
        $points = $this->parser->parse(['trackPoints' => [[
            'dateTime' => '2026-11-28T14:05:10Z',
            'position' => ['lat' => 558539418, 'lon' => -849546519],
        ]]]);

        $this->assertEqualsWithDelta(46.8169, $points[0]->latitude, 0.001);
        $this->assertEqualsWithDelta(-71.2083, $points[0]->longitude, 0.001);
    }

    public function test_skips_points_without_time_or_position_and_sorts_the_rest(): void
    {
        $points = $this->parser->parse(['trackPoints' => [
            ['dateTime' => '2026-11-28T14:06:00Z', 'position' => ['lat' => 46.81, 'lon' => -71.21]],
            ['position' => ['lat' => 46.81, 'lon' => -71.21]],
            ['dateTime' => '2026-11-28T14:07:00Z'],
            ['dateTime' => '2026-11-28T14:08:00Z', 'position' => ['lat' => 0, 'lon' => 0]],
            ['dateTime' => '2026-11-28T14:05:00Z', 'position' => ['lat' => 46.80, 'lon' => -71.20]],
            'garbage',
        ]]);

        $this->assertCount(2, $points);
        $this->assertSame('2026-11-28 14:05:00', $points[0]->recordedAt->toDateTimeString());
        $this->assertSame('2026-11-28 14:06:00', $points[1]->recordedAt->toDateTimeString());
    }

    public function test_an_unexpected_payload_gives_no_points(): void
    {
        $this->assertSame([], $this->parser->parse(null));
        $this->assertSame([], $this->parser->parse(['errors' => []]));
        $this->assertSame([], $this->parser->parse(['trackPoints' => 'nope']));
    }

    public function test_ignores_an_impossible_heart_rate(): void
    {
        $points = $this->parser->parse(['trackPoints' => [[
            'dateTime' => '2026-11-28T14:05:10Z',
            'position' => ['lat' => 46.8, 'lon' => -71.2],
            'heartRateBeatsPerMin' => 0,
        ]]]);

        $this->assertNull($points[0]->heartRate);
    }
}
