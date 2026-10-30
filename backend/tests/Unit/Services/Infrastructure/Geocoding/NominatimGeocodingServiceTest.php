<?php

namespace Tests\Unit\Services\Infrastructure\Geocoding;

use HiEvents\Exceptions\GeocodingUnavailableException;
use HiEvents\Services\Infrastructure\Geocoding\NominatimGeocodingService;
use Illuminate\Cache\ArrayStore;
use Illuminate\Cache\Repository as Cache;
use Illuminate\Config\Repository;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory as HttpClient;
use Illuminate\Http\Client\Request;
use Psr\Log\NullLogger;
use Tests\TestCase;

class NominatimGeocodingServiceTest extends TestCase
{
    public function testAFoundPlaceGivesItsCoordinates(): void
    {
        $httpClient = new HttpClient();
        $httpClient->fake(['*' => $httpClient->response([['lat' => '45.5017', 'lon' => '-73.5673']])]);

        $location = $this->service($httpClient)->search(['street' => '1 rue Principale', 'city' => 'Montréal'], 'ca');

        $this->assertSame(45.5017, $location->latitude);
        $this->assertSame(-73.5673, $location->longitude);
        $httpClient->assertSent(fn(Request $request) => str_starts_with($request->url(), 'https://nominatim.openstreetmap.org/search')
            && $request['street'] === '1 rue Principale'
            && $request['city'] === 'Montréal'
            && $request['countrycodes'] === 'ca'
            && $request['format'] === 'jsonv2'
            && $request->header('User-Agent')[0] === 'Billetterie (https://billets.example.com)');
    }

    public function testNoResultGivesNull(): void
    {
        $httpClient = new HttpClient();
        $httpClient->fake(['*' => $httpClient->response([])]);

        $this->assertNull($this->service($httpClient)->search(['q' => 'Nulle part']));
    }

    public function testAnUnreachableGeocoderIsReported(): void
    {
        $httpClient = new HttpClient();
        $httpClient->fake(fn() => throw new ConnectionException('timeout'));

        $this->expectException(GeocodingUnavailableException::class);

        $this->service($httpClient)->search(['q' => 'Sherbrooke']);
    }

    public function testAFailingGeocoderIsReported(): void
    {
        $httpClient = new HttpClient();
        $httpClient->fake(['*' => $httpClient->response('busy', 503)]);

        $this->expectException(GeocodingUnavailableException::class);

        $this->service($httpClient)->search(['q' => 'Sherbrooke']);
    }

    private function service(HttpClient $httpClient): NominatimGeocodingService
    {
        return new NominatimGeocodingService(
            config: new Repository(['app' => ['name' => 'Billetterie', 'frontend_url' => 'https://billets.example.com']]),
            httpClient: $httpClient,
            cache: new Cache(new ArrayStore()),
            logger: new NullLogger(),
        );
    }
}
