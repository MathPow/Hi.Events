<?php

declare(strict_types=1);

namespace HiEvents\Services\Infrastructure\Geocoding;

use HiEvents\Exceptions\GeocodingUnavailableException;
use HiEvents\Services\Infrastructure\Geocoding\DTO\GeocodedLocationDTO;
use Illuminate\Config\Repository;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Http\Client\Factory as HttpClient;
use Illuminate\Support\Str;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Cherche des coordonnees dans Nominatim, le geocodeur d'OpenStreetMap. Sa politique d'usage
 * demande une application identifiee et au plus une requete par seconde: les appels passent un
 * a un, espaces d'au moins MIN_INTERVAL_SECONDS. Les resultats sont gardes par l'appelant.
 */
class NominatimGeocodingService
{
    private const SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

    private const LOCK_KEY = 'nominatim-geocoding';

    private const LAST_CALL_KEY = 'nominatim-geocoding-last-call';

    private const MIN_INTERVAL_SECONDS = 1.1;

    // Les champs de l'adresse d'un resultat qui nomment sa ville, ou une partie (quartier,
    // arrondissement, agglomeration). Pas la province: « Québec » en est une aussi.
    private const LOCALITY_KEYS = ['city', 'town', 'village', 'municipality', 'hamlet', 'suburb', 'borough', 'city_district', 'county'];

    public function __construct(
        private readonly Repository      $config,
        private readonly HttpClient      $httpClient,
        private readonly Cache           $cache,
        private readonly LoggerInterface $logger,
    )
    {
    }

    /**
     * Avec une ville, seul un resultat situe dans cette ville compte: Nominatim confond les rues
     * de meme nom (« 3180 rue Laberge, Québec » donnait la rue Laberge de Montréal, dans la
     * province de Québec).
     *
     * @param array<string, string> $query Recherche libre (q) ou par champs (street, city, state, postalcode, country)
     * @throws GeocodingUnavailableException
     */
    public function search(array $query, ?string $countryCode = null, ?string $city = null): ?GeocodedLocationDTO
    {
        try {
            $response = $this->cache->lock(self::LOCK_KEY, 15)->block(10, function () use ($query, $countryCode, $city) {
                $this->waitForRateLimit();

                try {
                    return $this->httpClient
                        ->withHeaders(['User-Agent' => $this->userAgent()])
                        ->timeout(5)
                        ->get(self::SEARCH_URL, array_filter([
                            ...$query,
                            'format' => 'jsonv2',
                            'limit' => $city === null ? 1 : 5,
                            'addressdetails' => $city === null ? null : 1,
                            'countrycodes' => $countryCode,
                        ]));
                } finally {
                    $this->cache->put(self::LAST_CALL_KEY, microtime(true), 60);
                }
            });
        } catch (Throwable $exception) {
            $this->logger->warning('Nominatim geocoding could not be reached', [
                'exception' => $exception->getMessage(),
            ]);

            throw new GeocodingUnavailableException($exception->getMessage(), previous: $exception);
        }

        if (!$response->successful()) {
            $this->logger->warning('Nominatim geocoding failed', ['status' => $response->status()]);

            throw new GeocodingUnavailableException('Nominatim responded with status ' . $response->status());
        }

        $results = $response->json();
        $result = collect(is_array($results) ? $results : [])->first(fn($result) => is_array($result)
            && is_numeric($result['lat'] ?? null)
            && is_numeric($result['lon'] ?? null)
            && ($city === null || $this->isInCity($result, $city)));
        if ($result === null) {
            return null;
        }

        return new GeocodedLocationDTO(
            latitude: (float)$result['lat'],
            longitude: (float)$result['lon'],
        );
    }

    private function isInCity(array $result, string $city): bool
    {
        $wanted = $this->normalize($city);
        foreach (self::LOCALITY_KEYS as $key) {
            $place = is_string($result['address'][$key] ?? null) ? $this->normalize($result['address'][$key]) : '';
            if ($place !== '' && (str_contains(" $place ", " $wanted ") || str_contains(" $wanted ", " $place "))) {
                return true;
            }
        }

        return false;
    }

    private function normalize(string $value): string
    {
        return trim(preg_replace('/[^a-z0-9]+/', ' ', strtolower(Str::ascii($value))));
    }

    private function waitForRateLimit(): void
    {
        $lastCall = $this->cache->get(self::LAST_CALL_KEY);
        if (!is_numeric($lastCall)) {
            return;
        }

        $wait = self::MIN_INTERVAL_SECONDS - (microtime(true) - (float)$lastCall);
        if ($wait > 0) {
            usleep((int)($wait * 1_000_000));
        }
    }

    private function userAgent(): string
    {
        return sprintf('%s (%s)', $this->config->get('app.name'), $this->config->get('app.frontend_url'));
    }
}
