<?php

namespace HiEvents\Services\Domain\LiveTrack;

use Carbon\CarbonImmutable;
use HiEvents\Services\Domain\LiveTrack\DTO\LiveTrackPointDTO;
use Throwable;

/**
 * Reads the track points of Garmin LiveTrack's web page (an undocumented format): a point without
 * a time or a position is skipped rather than failing the whole batch.
 */
class LiveTrackPointParser
{
    private const SEMICIRCLES_TO_DEGREES = 180 / 2147483648;

    /**
     * @param mixed $payload The decoded JSON: {"trackPoints": [...]}
     * @return LiveTrackPointDTO[] Oldest first
     */
    public function parse(mixed $payload): array
    {
        $rawPoints = is_array($payload) ? ($payload['trackPoints'] ?? $payload['trackpoints'] ?? []) : [];
        if (!is_array($rawPoints)) {
            return [];
        }

        $points = [];
        foreach ($rawPoints as $rawPoint) {
            $point = is_array($rawPoint) ? $this->parsePoint($rawPoint) : null;
            if ($point !== null) {
                $points[] = $point;
            }
        }

        usort($points, static fn(LiveTrackPointDTO $a, LiveTrackPointDTO $b) => $a->recordedAt <=> $b->recordedAt);

        return $points;
    }

    private function parsePoint(array $raw): ?LiveTrackPointDTO
    {
        $recordedAt = $this->time($raw['dateTime'] ?? $raw['timestamp'] ?? null);
        $position = is_array($raw['position'] ?? null) ? $raw['position'] : $raw;
        $latitude = $this->degrees($position['lat'] ?? $position['latitude'] ?? null);
        $longitude = $this->degrees($position['lon'] ?? $position['lng'] ?? $position['longitude'] ?? null);

        if ($recordedAt === null || $latitude === null || $longitude === null
            || abs($latitude) > 90 || abs($longitude) > 180
            || ($latitude === 0.0 && $longitude === 0.0)) {
            return null;
        }

        $fitness = is_array($raw['fitnessPointData'] ?? null) ? $raw['fitnessPointData'] : [];
        $value = static fn(string ...$keys) => collect($keys)
            ->map(fn(string $key) => $raw[$key] ?? $fitness[$key] ?? null)
            ->first(fn($candidate) => is_numeric($candidate));
        $eventTypes = $raw['eventTypes'] ?? $fitness['eventTypes'] ?? [];

        return new LiveTrackPointDTO(
            recordedAt: $recordedAt,
            latitude: $latitude,
            longitude: $longitude,
            altitudeM: $this->float($value('altitude', 'elevation')),
            speedMps: $this->float($value('speedMetersPerSec', 'speed')),
            distanceM: $this->float($value('totalDistanceMeters', 'distanceMeters')),
            durationS: $this->int($value('totalDurationSecs', 'durationSecs')),
            elevationGainM: $this->float($value('totalElevationGainMeters', 'elevationGainMeters')),
            heartRate: $this->positiveInt($value('heartRateBeatsPerMin')),
            cadence: $this->positiveInt($value('cadenceCyclesPerMin')),
            isEnd: is_array($eventTypes) && in_array('END', $eventTypes, true),
        );
    }

    private function time(mixed $value): ?CarbonImmutable
    {
        if (!is_string($value) && !is_numeric($value)) {
            return null;
        }

        try {
            $time = is_numeric($value)
                ? CarbonImmutable::createFromTimestampMs((int)$value)
                : CarbonImmutable::parse($value);
        } catch (Throwable) {
            return null;
        }

        return $time->utc();
    }

    // Garmin keeps positions in semicircles in its files; the web page in degrees.
    private function degrees(mixed $value): ?float
    {
        if (!is_numeric($value)) {
            return null;
        }
        $degrees = (float)$value;

        return abs($degrees) > 180 ? $degrees * self::SEMICIRCLES_TO_DEGREES : $degrees;
    }

    private function float(mixed $value): ?float
    {
        return is_numeric($value) ? (float)$value : null;
    }

    private function int(mixed $value): ?int
    {
        return is_numeric($value) ? (int)round((float)$value) : null;
    }

    private function positiveInt(mixed $value): ?int
    {
        $int = $this->int($value);

        return $int !== null && $int > 0 && $int < 400 ? $int : null;
    }
}
