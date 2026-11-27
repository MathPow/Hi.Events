<?php

namespace Tests\Unit\Services\Infrastructure\LiveTrack;

use Carbon\CarbonImmutable;
use HiEvents\Exceptions\LiveTrackSessionNotFoundException;
use HiEvents\Exceptions\LiveTrackUnavailableException;
use HiEvents\Services\Domain\LiveTrack\DTO\LiveTrackLinkDTO;
use HiEvents\Services\Infrastructure\LiveTrack\GarminLiveTrackClient;
use Illuminate\Cache\ArrayStore;
use Illuminate\Cache\Repository as CacheRepository;
use Illuminate\Http\Client\Factory;
use Illuminate\Http\Client\Request;
use Mockery as m;
use Psr\Log\LoggerInterface;
use Tests\TestCase;

class GarminLiveTrackClientTest extends TestCase
{
    private const PAGE = '<html><head><meta name="csrf-token" content="CSRF-1"/></head></html>';

    private Factory $http;
    private GarminLiveTrackClient $client;
    private LiveTrackLinkDTO $link;

    protected function setUp(): void
    {
        parent::setUp();
        $this->http = new Factory();
        $this->client = new GarminLiveTrackClient(
            $this->http,
            new CacheRepository(new ArrayStore()),
            m::mock(LoggerInterface::class)->shouldIgnoreMissing(),
        );
        $this->link = new LiveTrackLinkDTO(sessionId: 'aaaa1111-bb22', token: 'TOKEN1');
    }

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }

    public function test_reads_the_track_points_with_the_page_csrf_token(): void
    {
        $this->http->fake([
            'livetrack.garmin.com/session/*' => $this->http->response(self::PAGE, 200, ['Set-Cookie' => 'SESSION=abc; Path=/']),
            'livetrack.garmin.com/api/sessions/*' => $this->http->response(['trackPoints' => [['dateTime' => 'x']]]),
        ]);

        $payload = $this->client->trackPoints($this->link, CarbonImmutable::parse('2026-11-28 14:00:00'));

        $this->assertSame(['trackPoints' => [['dateTime' => 'x']]], $payload);
        $this->http->assertSent(fn(Request $request) => str_contains($request->url(), '/api/sessions/aaaa1111-bb22/track-points/common')
            && $request['token'] === 'TOKEN1'
            && $request['begin'] === '2026-11-28T14:00:00.001Z'
            && $request->header('Livetrack-Csrf-Token') === ['CSRF-1']
            && str_contains($request->header('Cookie')[0] ?? '', 'SESSION=abc'));
    }

    public function test_the_csrf_token_is_reused_between_calls(): void
    {
        $this->http->fake([
            'livetrack.garmin.com/session/*' => $this->http->response(self::PAGE),
            'livetrack.garmin.com/api/*' => $this->http->response(['trackPoints' => []]),
        ]);

        $this->client->trackPoints($this->link);
        $this->client->trackPoints($this->link);

        $pageLoads = collect($this->http->recorded())->filter(fn($pair) => str_contains($pair[0]->url(), '/session/'));
        $this->assertCount(1, $pageLoads);
    }

    public function test_an_expired_csrf_token_is_renewed_once(): void
    {
        $this->http->fake([
            'livetrack.garmin.com/session/*' => $this->http->response(self::PAGE),
            'livetrack.garmin.com/api/*' => $this->http->sequence()
                ->push('', 403)
                ->push(['trackPoints' => []]),
        ]);

        $this->assertSame(['trackPoints' => []], $this->client->trackPoints($this->link));
    }

    public function test_an_unknown_session_is_not_found(): void
    {
        $this->http->fake([
            'livetrack.garmin.com/session/*' => $this->http->response(self::PAGE),
            'livetrack.garmin.com/api/*' => $this->http->response(['errors' => []], 404),
        ]);

        $this->expectException(LiveTrackSessionNotFoundException::class);

        $this->client->session($this->link);
    }

    public function test_a_page_without_csrf_token_is_unavailable(): void
    {
        $this->http->fake(['livetrack.garmin.com/*' => $this->http->response('<html></html>')]);

        $this->expectException(LiveTrackUnavailableException::class);

        $this->client->trackPoints($this->link);
    }

    public function test_a_server_error_is_unavailable(): void
    {
        $this->http->fake([
            'livetrack.garmin.com/session/*' => $this->http->response(self::PAGE),
            'livetrack.garmin.com/api/*' => $this->http->response('oops', 500),
        ]);

        $this->expectException(LiveTrackUnavailableException::class);

        $this->client->trackPoints($this->link);
    }
}
