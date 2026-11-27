<?php

declare(strict_types=1);

namespace HiEvents\Services\Infrastructure\LiveTrack;

use Carbon\CarbonInterface;
use HiEvents\Exceptions\LiveTrackSessionNotFoundException;
use HiEvents\Exceptions\LiveTrackUnavailableException;
use HiEvents\Services\Domain\LiveTrack\DTO\LiveTrackLinkDTO;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Http\Client\Factory as HttpClient;
use Illuminate\Http\Client\Response;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Reads a shared session the way Garmin LiveTrack's own web page does: Garmin has no public
 * API for LiveTrack, so this can break whenever they change their page. Its JSON calls need the
 * page's CSRF token and cookies, kept a few minutes and shared by every session.
 */
class GarminLiveTrackClient
{
    private const HOST = 'https://livetrack.garmin.com';

    private const CSRF_CACHE_KEY = 'garmin-livetrack-csrf';

    private const CSRF_TTL_SECONDS = 900;

    private const TIMEOUT_SECONDS = 10;

    private const USER_AGENT = 'BilletterieDehors/1.0 (+https://billets.dehorsqc.com)';

    public function __construct(
        private readonly HttpClient      $httpClient,
        private readonly Cache           $cache,
        private readonly LoggerInterface $logger,
    )
    {
    }

    /**
     * @return mixed The decoded JSON, {"trackPoints": [...]}
     * @throws LiveTrackSessionNotFoundException|LiveTrackUnavailableException
     */
    public function trackPoints(LiveTrackLinkDTO $link, ?CarbonInterface $after = null): mixed
    {
        $query = ['token' => $link->token];
        if ($after !== null) {
            $query['begin'] = $after->copy()->utc()->addMillisecond()->format('Y-m-d\TH:i:s.v\Z');
        }

        return $this->getJson($link, '/api/sessions/' . rawurlencode($link->sessionId) . '/track-points/common', $query);
    }

    /**
     * The session's details (whose it is, whether it has ended).
     *
     * @throws LiveTrackSessionNotFoundException|LiveTrackUnavailableException
     */
    public function session(LiveTrackLinkDTO $link): array
    {
        $session = $this->getJson($link, '/api/v2/sessions/' . rawurlencode($link->sessionId), ['token' => $link->token]);

        return is_array($session) ? $session : [];
    }

    /**
     * @throws LiveTrackSessionNotFoundException|LiveTrackUnavailableException
     */
    private function getJson(LiveTrackLinkDTO $link, string $path, array $query, bool $retried = false): mixed
    {
        $csrf = $this->csrf($link);

        try {
            $response = $this->httpClient
                ->timeout(self::TIMEOUT_SECONDS)
                ->withUserAgent(self::USER_AGENT)
                ->withHeaders(['Accept' => 'application/json', 'Livetrack-Csrf-Token' => $csrf['token']])
                ->withCookies($csrf['cookies'], 'livetrack.garmin.com')
                ->get(self::HOST . $path, $query);
        } catch (Throwable $exception) {
            throw new LiveTrackUnavailableException($exception->getMessage(), previous: $exception);
        }

        if ($response->status() === 404) {
            throw new LiveTrackSessionNotFoundException(__('Garmin no longer knows this LiveTrack session.'));
        }

        // The token expired between two polls: a fresh one, once.
        if (in_array($response->status(), [401, 403], true) && !$retried) {
            $this->cache->forget(self::CSRF_CACHE_KEY);

            return $this->getJson($link, $path, $query, true);
        }

        if (!$response->successful()) {
            $this->logger->warning('Garmin LiveTrack answered with an error', [
                'path' => $path,
                'status' => $response->status(),
                'body' => mb_substr($response->body(), 0, 300),
            ]);

            throw new LiveTrackUnavailableException('Garmin LiveTrack answered ' . $response->status());
        }

        return $response->json();
    }

    /**
     * @return array{token: string, cookies: array<string, string>}
     * @throws LiveTrackUnavailableException
     */
    private function csrf(LiveTrackLinkDTO $link): array
    {
        $cached = $this->cache->get(self::CSRF_CACHE_KEY);
        if (is_array($cached) && isset($cached['token'], $cached['cookies'])) {
            return $cached;
        }

        try {
            $response = $this->httpClient
                ->timeout(self::TIMEOUT_SECONDS)
                ->withUserAgent(self::USER_AGENT)
                ->get($link->url());
        } catch (Throwable $exception) {
            throw new LiveTrackUnavailableException($exception->getMessage(), previous: $exception);
        }

        $token = $this->csrfToken($response);
        if ($token === null) {
            $this->logger->warning('Garmin LiveTrack page has no CSRF token', ['status' => $response->status()]);

            throw new LiveTrackUnavailableException('Garmin LiveTrack page has no CSRF token');
        }

        $cookies = [];
        foreach ($response->cookies()->toArray() as $cookie) {
            if (isset($cookie['Name'], $cookie['Value'])) {
                $cookies[$cookie['Name']] = $cookie['Value'];
            }
        }

        $csrf = ['token' => $token, 'cookies' => $cookies];
        $this->cache->put(self::CSRF_CACHE_KEY, $csrf, self::CSRF_TTL_SECONDS);

        return $csrf;
    }

    private function csrfToken(Response $response): ?string
    {
        return preg_match('~<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"~i', $response->body(), $matches) === 1
            ? $matches[1]
            : null;
    }
}
