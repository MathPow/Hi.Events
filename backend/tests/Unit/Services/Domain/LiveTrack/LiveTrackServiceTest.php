<?php

namespace Tests\Unit\Services\Domain\LiveTrack;

use Carbon\Carbon;
use Carbon\CarbonImmutable;
use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\LiveTrackDomainObject;
use HiEvents\DomainObjects\Status\LiveTrackStatus;
use HiEvents\Exceptions\InvalidLiveTrackLinkException;
use HiEvents\Exceptions\LiveTrackSessionNotFoundException;
use HiEvents\Exceptions\LiveTrackUnavailableException;
use HiEvents\Repository\Interfaces\LiveTrackPointRepositoryInterface;
use HiEvents\Repository\Interfaces\LiveTrackRepositoryInterface;
use HiEvents\Services\Domain\LiveTrack\DTO\LiveTrackPointDTO;
use HiEvents\Services\Domain\LiveTrack\LiveTrackLinkParser;
use HiEvents\Services\Domain\LiveTrack\LiveTrackPointParser;
use HiEvents\Services\Domain\LiveTrack\LiveTrackService;
use HiEvents\Services\Infrastructure\LiveTrack\GarminLiveTrackClient;
use Mockery as m;
use Mockery\MockInterface;
use Psr\Log\LoggerInterface;
use Tests\TestCase;

class LiveTrackServiceTest extends TestCase
{
    private const LINK = 'https://livetrack.garmin.com/session/aaaa1111-bb22-cc33-dd44-eeeeee555555/token/TOKEN1';

    private LiveTrackRepositoryInterface|MockInterface $liveTrackRepository;
    private LiveTrackPointRepositoryInterface|MockInterface $pointRepository;
    private GarminLiveTrackClient|MockInterface $client;
    private LiveTrackService $service;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-28 15:00:00');
        CarbonImmutable::setTestNow('2026-11-28 15:00:00');

        $this->liveTrackRepository = m::mock(LiveTrackRepositoryInterface::class);
        $this->pointRepository = m::mock(LiveTrackPointRepositoryInterface::class);
        $this->client = m::mock(GarminLiveTrackClient::class);

        $this->service = new LiveTrackService(
            $this->liveTrackRepository,
            $this->pointRepository,
            new LiveTrackLinkParser(),
            new LiveTrackPointParser(),
            $this->client,
            m::mock(LoggerInterface::class)->shouldIgnoreMissing(),
        );
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        CarbonImmutable::setTestNow();
        $this->addToAssertionCount(m::getContainer()->mockery_getExpectationCount());
        m::close();
        parent::tearDown();
    }

    public function test_sharing_a_link_garmin_does_not_know_is_refused(): void
    {
        $this->client->shouldReceive('session')->andThrow(new LiveTrackSessionNotFoundException());
        $this->liveTrackRepository->shouldNotReceive('create');

        $this->expectException(InvalidLiveTrackLinkException::class);

        $this->service->share($this->attendee(), self::LINK);
    }

    public function test_sharing_a_new_link_starts_a_waiting_track_and_reads_it_once(): void
    {
        $this->client->shouldReceive('session')->once()->andReturn([]);
        $this->liveTrackRepository->shouldReceive('findFirstWhere')->andReturnNull();
        $this->liveTrackRepository->shouldReceive('create')->once()
            ->with(m::on(fn(array $attributes) => $attributes['session_id'] === 'aaaa1111-bb22-cc33-dd44-eeeeee555555'
                && $attributes['session_token'] === 'TOKEN1'
                && $attributes['status'] === LiveTrackStatus::WAITING->name
                && $attributes['attendee_id'] === 7
                && $attributes['event_id'] === 3))
            ->andReturn($this->track());
        $this->client->shouldReceive('trackPoints')->once()->andReturn(['trackPoints' => []]);
        $this->liveTrackRepository->shouldReceive('updateFromArray')->once()
            ->with(1, m::on(fn(array $attributes) => $attributes['status'] === LiveTrackStatus::WAITING->name))
            ->andReturn($this->track());

        $this->service->share($this->attendee(), self::LINK);
    }

    public function test_a_different_activity_replaces_the_previous_track(): void
    {
        $this->client->shouldReceive('session')->andReturn([]);
        $previous = $this->track()->setId(9)->setSessionId('another-session-id');
        $this->liveTrackRepository->shouldReceive('findFirstWhere')->andReturn($previous);
        $this->liveTrackRepository->shouldReceive('deleteById')->once()->with(9);
        $this->liveTrackRepository->shouldReceive('create')->once()->andReturn($this->track());
        $this->client->shouldReceive('trackPoints')->andReturn(['trackPoints' => []]);
        $this->liveTrackRepository->shouldReceive('updateFromArray')->andReturn($this->track());

        $this->service->share($this->attendee(), self::LINK);
    }

    public function test_new_points_make_the_track_active_with_the_latest_figures(): void
    {
        $this->client->shouldReceive('trackPoints')->andReturn(['trackPoints' => [
            $this->rawPoint('2026-11-28T14:50:00Z', 46.8100, -71.2000, ['totalDistanceMeters' => 1000, 'heartRateBeatsPerMin' => 140]),
            $this->rawPoint('2026-11-28T14:50:03Z', 46.8101, -71.2001),
            $this->rawPoint('2026-11-28T14:50:30Z', 46.8120, -71.2010, ['totalDistanceMeters' => 1250, 'heartRateBeatsPerMin' => 152, 'speedMetersPerSec' => 3.2]),
        ]]);
        $this->pointRepository->shouldReceive('insertIgnoringDuplicates')->once()
            ->with(m::on(fn(array $rows) => count($rows) === 2
                && $rows[0]['recorded_at'] === '2026-11-28 14:50:00'
                && $rows[1]['recorded_at'] === '2026-11-28 14:50:30'));
        $this->liveTrackRepository->shouldReceive('updateFromArray')->once()
            ->with(1, m::on(fn(array $attributes) => $attributes['status'] === LiveTrackStatus::ACTIVE->name
                && $attributes['last_point_at'] === '2026-11-28 14:50:30'
                && $attributes['latitude'] === 46.812
                && $attributes['distance_m'] === 1250.0
                && $attributes['heart_rate'] === 152
                && $attributes['still_since'] === null
                && $attributes['points_count'] === 2))
            ->andReturn($this->track());

        $this->service->poll($this->track());
    }

    public function test_a_full_page_of_points_reads_the_next_page(): void
    {
        $firstPage = [];
        for ($i = 0; $i < 100; $i++) {
            $firstPage[] = $this->rawPoint(sprintf('2026-11-28T14:%02d:%02dZ', intdiv($i * 3, 60), ($i * 3) % 60), 46.81, -71.20);
        }
        $this->client->shouldReceive('trackPoints')->once()->with(m::any(), null)->andReturn(['trackPoints' => $firstPage]);
        $this->client->shouldReceive('trackPoints')->once()
            ->with(m::any(), m::on(fn($after) => $after->toDateTimeString() === '2026-11-28 14:04:57'))
            ->andReturn(['trackPoints' => [$this->rawPoint('2026-11-28T14:05:30Z', 46.82, -71.21)]]);
        $this->pointRepository->shouldReceive('insertIgnoringDuplicates')->once();
        $this->liveTrackRepository->shouldReceive('updateFromArray')->once()
            ->with(1, m::on(fn(array $attributes) => $attributes['last_point_at'] === '2026-11-28 14:05:30'))
            ->andReturn($this->track());

        $this->service->poll($this->track());
    }

    public function test_the_end_of_the_activity_ends_the_track(): void
    {
        $this->client->shouldReceive('trackPoints')->andReturn(['trackPoints' => [
            $this->rawPoint('2026-11-28T14:59:00Z', 46.81, -71.20, ['eventTypes' => ['END']]),
        ]]);
        $this->pointRepository->shouldReceive('insertIgnoringDuplicates')->once();
        $this->liveTrackRepository->shouldReceive('updateFromArray')->once()
            ->with(1, m::on(fn(array $attributes) => $attributes['status'] === LiveTrackStatus::ENDED->name))
            ->andReturn($this->track());

        $this->service->poll($this->track());
    }

    public function test_only_points_after_the_last_one_are_kept(): void
    {
        $track = $this->track()->setStatus(LiveTrackStatus::ACTIVE->name)->setLastPointAt('2026-11-28 14:50:00')
            ->setLatitude(46.81)->setLongitude(-71.20)->setPointsCount(10);
        $this->client->shouldReceive('trackPoints')
            ->with(m::any(), m::on(fn($after) => $after->toDateTimeString() === '2026-11-28 14:50:00'))
            ->andReturn(['trackPoints' => [$this->rawPoint('2026-11-28T14:50:00Z', 46.81, -71.20)]]);
        $this->pointRepository->shouldNotReceive('insertIgnoringDuplicates');
        $this->liveTrackRepository->shouldReceive('updateFromArray')->once()
            ->with(1, m::on(fn(array $attributes) => $attributes['status'] === LiveTrackStatus::ACTIVE->name
                && !array_key_exists('points_count', $attributes)))
            ->andReturn($track);

        $this->service->poll($track);
    }

    public function test_a_track_silent_for_hours_has_ended(): void
    {
        $track = $this->track()->setStatus(LiveTrackStatus::ACTIVE->name)->setLastPointAt('2026-11-28 11:30:00');
        $this->client->shouldReceive('trackPoints')->andReturn(['trackPoints' => []]);
        $this->liveTrackRepository->shouldReceive('updateFromArray')->once()
            ->with(1, m::on(fn(array $attributes) => $attributes['status'] === LiveTrackStatus::ENDED->name))
            ->andReturn($track);

        $this->service->poll($track);
    }

    public function test_a_session_garmin_forgot_fails_before_any_point_and_ends_after(): void
    {
        $this->client->shouldReceive('trackPoints')->andThrow(new LiveTrackSessionNotFoundException('gone'));
        $this->liveTrackRepository->shouldReceive('updateFromArray')->once()
            ->with(1, m::on(fn(array $attributes) => $attributes['status'] === LiveTrackStatus::FAILED->name))
            ->andReturn($this->track());

        $this->service->poll($this->track());
    }

    public function test_garmin_out_of_reach_keeps_the_status_and_notes_the_error(): void
    {
        $track = $this->track()->setStatus(LiveTrackStatus::ACTIVE->name);
        $this->client->shouldReceive('trackPoints')->andThrow(new LiveTrackUnavailableException('timeout'));
        $this->liveTrackRepository->shouldReceive('updateFromArray')->once()
            ->with(1, m::on(fn(array $attributes) => !array_key_exists('status', $attributes)
                && $attributes['last_error'] === 'timeout'))
            ->andReturn($track);

        $this->service->poll($track);
    }

    public function test_thin_keeps_a_point_every_ten_seconds_plus_the_last_and_the_end(): void
    {
        $points = [
            $this->point('14:00:00'),
            $this->point('14:00:03'),
            $this->point('14:00:09'),
            $this->point('14:00:10'),
            $this->point('14:00:12', isEnd: true),
            $this->point('14:00:14'),
        ];

        $kept = array_map(fn(LiveTrackPointDTO $point) => $point->recordedAt->format('H:i:s'), $this->service->thin($points));

        $this->assertSame(['14:00:00', '14:00:10', '14:00:12', '14:00:14'], $kept);
    }

    public function test_still_since_starts_when_the_participant_stops_and_clears_when_they_move(): void
    {
        $track = $this->track()->setLatitude(46.8100)->setLongitude(-71.2000)->setLastPointAt('2026-11-28 14:00:00');

        $stopped = $this->service->stillSince($track, [
            $this->point('14:01:00', 46.81001, -71.20001),
            $this->point('14:02:00', 46.81002, -71.20001),
        ]);
        $this->assertSame('2026-11-28 14:00:00', $stopped?->toDateTimeString());

        $moving = $this->service->stillSince($track->setStillSince('2026-11-28 14:00:00'), [
            $this->point('14:01:00', 46.8120, -71.2000),
        ]);
        $this->assertNull($moving);
    }

    private function attendee(): AttendeeDomainObject
    {
        return (new AttendeeDomainObject())->setId(7)->setEventId(3)->setShortId('A-ABC');
    }

    private function track(): LiveTrackDomainObject
    {
        return (new LiveTrackDomainObject())
            ->setId(1)
            ->setEventId(3)
            ->setAttendeeId(7)
            ->setShareUrl(self::LINK)
            ->setSessionId('aaaa1111-bb22-cc33-dd44-eeeeee555555')
            ->setSessionToken('TOKEN1')
            ->setStatus(LiveTrackStatus::WAITING->name)
            ->setConsentedAt('2026-11-28 14:00:00')
            ->setPointsCount(0);
    }

    private function rawPoint(string $at, float $lat, float $lon, array $extra = []): array
    {
        return ['dateTime' => $at, 'position' => ['lat' => $lat, 'lon' => $lon], ...$extra];
    }

    private function point(string $time, float $lat = 46.81, float $lon = -71.20, bool $isEnd = false): LiveTrackPointDTO
    {
        return new LiveTrackPointDTO(
            recordedAt: CarbonImmutable::parse('2026-11-28 ' . $time),
            latitude: $lat,
            longitude: $lon,
            isEnd: $isEnd,
        );
    }
}
