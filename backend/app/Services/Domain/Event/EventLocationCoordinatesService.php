<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Event;

use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\Generated\EventSettingDomainObjectAbstract;
use HiEvents\Exceptions\GeocodingUnavailableException;
use HiEvents\Repository\Interfaces\EventSettingsRepositoryInterface;
use HiEvents\Services\Infrastructure\Geocoding\DTO\GeocodedLocationDTO;
use HiEvents\Services\Infrastructure\Geocoding\NominatimGeocodingService;

/**
 * Les coordonnees du lieu d'un evenement, pour la carte de sa page. Cherchees une fois par
 * adresse (le lien de carte de l'organisateur d'abord, puis l'adresse, le lieu, la ville) et
 * gardees avec l'empreinte de l'adresse: une adresse modifiee est cherchee de nouveau. Une
 * adresse introuvable est aussi gardee (sans coordonnees); un geocodeur injoignable, non.
 */
class EventLocationCoordinatesService
{
    public function __construct(
        private readonly NominatimGeocodingService        $geocodingService,
        private readonly EventSettingsRepositoryInterface $eventSettingsRepository,
    )
    {
    }

    public function getCoordinates(EventSettingDomainObject $settings): ?GeocodedLocationDTO
    {
        $details = $this->locationDetails($settings);
        if ($settings->getIsOnlineEvent() || $this->clean($details, ['address_line_1', 'venue_name', 'city', 'zip_or_postal_code']) === []) {
            return null;
        }

        $fingerprint = $this->fingerprint($details, $settings->getMapsUrl());
        if ($settings->getLocationGeocodedFor() === $fingerprint) {
            return $settings->getLocationLatitude() !== null && $settings->getLocationLongitude() !== null
                ? new GeocodedLocationDTO((float)$settings->getLocationLatitude(), (float)$settings->getLocationLongitude())
                : null;
        }

        try {
            $location = $this->coordinatesFromMapsUrl($settings->getMapsUrl()) ?? $this->geocode($details);
        } catch (GeocodingUnavailableException) {
            return null;
        }

        $this->eventSettingsRepository->updateWhere(
            attributes: [
                EventSettingDomainObjectAbstract::LOCATION_LATITUDE => $location?->latitude,
                EventSettingDomainObjectAbstract::LOCATION_LONGITUDE => $location?->longitude,
                EventSettingDomainObjectAbstract::LOCATION_GEOCODED_FOR => $fingerprint,
            ],
            where: [EventSettingDomainObjectAbstract::ID => $settings->getId()],
        );

        return $location;
    }

    /**
     * @throws GeocodingUnavailableException
     */
    private function geocode(array $details): ?GeocodedLocationDTO
    {
        $country = $details['country'] ?? '';
        $countryCode = strlen($country) === 2 ? strtolower($country) : null;

        foreach ($this->queries($details, $countryCode === null ? $country : null) as $query) {
            $location = $this->geocodingService->search($query, $countryCode, $details['city'] ?? null);
            if ($location !== null) {
                return $location;
            }
        }

        return null;
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function queries(array $details, ?string $countryName): array
    {
        $queries = [];

        if (($details['address_line_1'] ?? '') !== '') {
            $queries[] = array_filter([
                'street' => $details['address_line_1'],
                'city' => $details['city'] ?? '',
                'state' => $details['state_or_region'] ?? '',
                'postalcode' => $details['zip_or_postal_code'] ?? '',
                'country' => $countryName ?? '',
            ]);
        }

        if (($details['venue_name'] ?? '') !== '') {
            $queries[] = ['q' => $this->join($details, ['venue_name', 'city', 'state_or_region'])];
            $queries[] = ['q' => $this->join($details, ['venue_name', 'state_or_region'])];
        }

        $place = $this->join($details, ['city', 'state_or_region', 'zip_or_postal_code']);
        if ($place !== '') {
            $queries[] = ['q' => $place];
        }

        return array_values(array_unique($queries, SORT_REGULAR));
    }

    private function coordinatesFromMapsUrl(?string $mapsUrl): ?GeocodedLocationDTO
    {
        if ($mapsUrl === null || trim($mapsUrl) === '') {
            return null;
        }

        $url = urldecode($mapsUrl);
        $patterns = [
            '/!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/',
            '/[?&](?:q|query|ll|destination|center)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/',
            '/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $url, $matches)) {
                $latitude = (float)$matches[1];
                $longitude = (float)$matches[2];

                if (abs($latitude) <= 90 && abs($longitude) <= 180) {
                    return new GeocodedLocationDTO($latitude, $longitude);
                }
            }
        }

        return null;
    }

    /**
     * @return array<string, string>
     */
    private function locationDetails(EventSettingDomainObject $settings): array
    {
        $details = $settings->getLocationDetails();
        if (is_string($details)) {
            $details = json_decode($details, true);
        }

        return $this->clean(is_array($details) ? $details : [], [
            'venue_name',
            'address_line_1',
            'address_line_2',
            'city',
            'state_or_region',
            'zip_or_postal_code',
            'country',
        ]);
    }

    /**
     * @return array<string, string>
     */
    private function clean(array $details, array $keys): array
    {
        $cleaned = [];
        foreach ($keys as $key) {
            $value = is_scalar($details[$key] ?? null) ? trim((string)$details[$key]) : '';
            if ($value !== '') {
                $cleaned[$key] = $value;
            }
        }

        return $cleaned;
    }

    private function join(array $details, array $keys): string
    {
        return implode(', ', $this->clean($details, $keys));
    }

    // Le numero de la recherche: les coordonnees trouvees avant qu'un resultat doive etre dans
    // la ville de l'adresse sont cherchees de nouveau.
    private function fingerprint(array $details, ?string $mapsUrl): string
    {
        return sha1(json_encode([$details, trim((string)$mapsUrl), 2]));
    }
}
