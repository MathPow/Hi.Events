<?php

namespace Tests\Unit\Services\Domain\Event;

use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\Exceptions\GeocodingUnavailableException;
use HiEvents\Repository\Interfaces\EventSettingsRepositoryInterface;
use HiEvents\Services\Domain\Event\EventLocationCoordinatesService;
use HiEvents\Services\Infrastructure\Geocoding\DTO\GeocodedLocationDTO;
use HiEvents\Services\Infrastructure\Geocoding\NominatimGeocodingService;
use Mockery;
use Mockery\MockInterface;
use Tests\TestCase;

class EventLocationCoordinatesServiceTest extends TestCase
{
    private const MAPS_URL = 'https://www.google.com/maps/place/Mont+Ham/@45.7712,-71.6211,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d45.7756!4d-71.6189';

    private NominatimGeocodingService&MockInterface $geocodingService;

    private EventSettingsRepositoryInterface&MockInterface $eventSettingsRepository;

    private EventLocationCoordinatesService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->geocodingService = Mockery::mock(NominatimGeocodingService::class);
        $this->eventSettingsRepository = Mockery::mock(EventSettingsRepositoryInterface::class);
        $this->service = new EventLocationCoordinatesService($this->geocodingService, $this->eventSettingsRepository);
    }

    public function testAnOnlineEventHasNoCoordinates(): void
    {
        $this->geocodingService->shouldNotReceive('search');
        $this->eventSettingsRepository->shouldNotReceive('updateWhere');

        $this->assertNull($this->service->getCoordinates($this->settings(online: true)));
    }

    public function testTheAddressIsSearchedFirstAndTheResultKept(): void
    {
        $this->geocodingService->shouldReceive('search')->once()
            ->with([
                'street' => '1 rue Principale',
                'city' => 'Sherbrooke',
                'state' => 'QC',
                'postalcode' => 'J1H 1A1',
            ], 'ca', 'Sherbrooke')
            ->andReturn(new GeocodedLocationDTO(45.4, -71.89, 'Estrie'));
        $this->eventSettingsRepository->shouldReceive('updateWhere')->once()
            ->with(Mockery::on(fn(array $attributes) => $attributes['location_latitude'] === 45.4
                && $attributes['location_longitude'] === -71.89
                && $attributes['location_region'] === 'Estrie'
                && str_starts_with($attributes['location_geocoded_for'], EventLocationCoordinatesService::FINGERPRINT_VERSION)), ['id' => 7]);

        $location = $this->service->getCoordinates($this->settings());

        $this->assertSame(45.4, $location->latitude);
        $this->assertSame('Estrie', $location->region);
    }

    public function testAPlaceFoundBeforeRegionsIsSearchedAgain(): void
    {
        $settings = $this->settings()
            ->setLocationLatitude(45.4)
            ->setLocationLongitude(-71.89)
            ->setLocationGeocodedFor(sha1(json_encode([$this->settings()->getLocationDetails(), '', 2])));

        $this->geocodingService->shouldReceive('search')->once()->andReturn(new GeocodedLocationDTO(45.4, -71.89, 'Estrie'));
        $this->eventSettingsRepository->shouldReceive('updateWhere')->once()
            ->with(Mockery::on(fn(array $attributes) => $attributes['location_region'] === 'Estrie'), ['id' => 7]);

        $this->assertSame('Estrie', $this->service->getCoordinates($settings)->region);
    }

    public function testTheVenueIsSearchedWhenTheAddressIsNotFound(): void
    {
        $this->geocodingService->shouldReceive('search')->once()
            ->with(Mockery::on(fn(array $query) => isset($query['street'])), 'ca', 'Sherbrooke')
            ->andReturnNull();
        $this->geocodingService->shouldReceive('search')->once()
            ->with(['q' => 'Mont Ham, Sherbrooke, QC'], 'ca', 'Sherbrooke')
            ->andReturn(new GeocodedLocationDTO(45.77, -71.62));
        $this->eventSettingsRepository->shouldReceive('updateWhere')->once();

        $this->assertSame(45.77, $this->service->getCoordinates($this->settings(venue: 'Mont Ham'))->latitude);
    }

    public function testANaturalPlaceIsFoundByItsNameInItsRegion(): void
    {
        $this->geocodingService->shouldReceive('search')->twice()->andReturnNull();
        $this->geocodingService->shouldReceive('search')->once()
            ->with(['q' => 'Mont Ham, QC'], 'ca', 'Sherbrooke')
            ->andReturn(new GeocodedLocationDTO(45.79, -71.63));
        $this->eventSettingsRepository->shouldReceive('updateWhere')->once();

        $this->assertSame(-71.63, $this->service->getCoordinates($this->settings(venue: 'Mont Ham'))->longitude);
    }

    public function testKeptCoordinatesAreReusedForTheSameAddress(): void
    {
        $fingerprint = null;
        $this->geocodingService->shouldReceive('search')->once()->andReturn(new GeocodedLocationDTO(45.4, -71.89));
        $this->eventSettingsRepository->shouldReceive('updateWhere')->once()
            ->with(Mockery::on(function (array $attributes) use (&$fingerprint) {
                $fingerprint = $attributes['location_geocoded_for'];
                return true;
            }), Mockery::any());
        $this->service->getCoordinates($this->settings());

        $kept = $this->settings()
            ->setLocationLatitude(45.4)
            ->setLocationLongitude(-71.89)
            ->setLocationGeocodedFor($fingerprint);

        $this->assertSame(-71.89, $this->service->getCoordinates($kept)->longitude);
    }

    public function testAChangedAddressIsSearchedAgain(): void
    {
        $settings = $this->settings()
            ->setLocationLatitude(45.4)
            ->setLocationLongitude(-71.89)
            ->setLocationGeocodedFor(sha1('an older address'));

        $this->geocodingService->shouldReceive('search')->once()->andReturn(new GeocodedLocationDTO(46.81, -71.21));
        $this->eventSettingsRepository->shouldReceive('updateWhere')->once();

        $this->assertSame(46.81, $this->service->getCoordinates($settings)->latitude);
    }

    public function testCoordinatesInTheMapLinkAreUsedWithoutSearching(): void
    {
        $this->geocodingService->shouldNotReceive('search');
        $this->geocodingService->shouldReceive('region')->once()->with(45.7756, -71.6189)->andReturn('Estrie');
        $this->eventSettingsRepository->shouldReceive('updateWhere')->once()
            ->with(Mockery::on(fn(array $attributes) => $attributes['location_region'] === 'Estrie'), ['id' => 7]);

        $location = $this->service->getCoordinates($this->settings(mapsUrl: self::MAPS_URL));

        $this->assertSame(45.7756, $location->latitude);
        $this->assertSame(-71.6189, $location->longitude);
    }

    public function testTheMapLinkStillShowsTheMapWhenTheRegionCannotBeFound(): void
    {
        $this->geocodingService->shouldReceive('region')->once()->andThrow(new GeocodingUnavailableException('timeout'));
        // Not kept: the region is looked up again next time.
        $this->eventSettingsRepository->shouldNotReceive('updateWhere');

        $location = $this->service->getCoordinates($this->settings(mapsUrl: self::MAPS_URL));

        $this->assertSame(45.7756, $location->latitude);
        $this->assertNull($location->region);
    }

    public function testAnAddressNobodyFindsIsKeptWithoutCoordinates(): void
    {
        $this->geocodingService->shouldReceive('search')->twice()->andReturnNull();
        $this->eventSettingsRepository->shouldReceive('updateWhere')->once()
            ->with(Mockery::on(fn(array $attributes) => $attributes['location_latitude'] === null
                && $attributes['location_geocoded_for'] !== null), ['id' => 7]);

        $this->assertNull($this->service->getCoordinates($this->settings()));
    }

    public function testAnUnreachableGeocoderKeepsNothing(): void
    {
        $this->geocodingService->shouldReceive('search')->once()->andThrow(new GeocodingUnavailableException('timeout'));
        $this->eventSettingsRepository->shouldNotReceive('updateWhere');

        $this->assertNull($this->service->getCoordinates($this->settings()));
    }

    private function settings(bool $online = false, ?string $venue = null, ?string $mapsUrl = null): EventSettingDomainObject
    {
        return (new EventSettingDomainObject())
            ->setId(7)
            ->setIsOnlineEvent($online)
            ->setMapsUrl($mapsUrl)
            ->setLocationDetails(array_filter([
                'venue_name' => $venue,
                'address_line_1' => '1 rue Principale',
                'city' => 'Sherbrooke',
                'state_or_region' => 'QC',
                'zip_or_postal_code' => 'J1H 1A1',
                'country' => 'CA',
            ]));
    }
}
