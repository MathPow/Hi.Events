<?php

namespace Tests\Unit\Jobs\Event;

use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\Jobs\Event\LocateEventsJob;
use HiEvents\Repository\Interfaces\EventSettingsRepositoryInterface;
use HiEvents\Services\Domain\Event\EventLocationCoordinatesService;
use Mockery;
use Tests\TestCase;

class LocateEventsJobTest extends TestCase
{
    public function testEventsNotLocatedSinceRegionsAreLookedUpAFewAtATime(): void
    {
        $first = (new EventSettingDomainObject())->setId(1);
        $second = (new EventSettingDomainObject())->setId(2);

        $repository = Mockery::mock(EventSettingsRepositoryInterface::class);
        $repository->shouldReceive('findNotLocatedWith')->once()
            ->with(EventLocationCoordinatesService::FINGERPRINT_VERSION, LocateEventsJob::BATCH_SIZE)
            ->andReturn(collect([$first, $second]));

        $coordinatesService = Mockery::mock(EventLocationCoordinatesService::class);
        $coordinatesService->shouldReceive('getCoordinates')->once()->with($first)->andReturnNull();
        $coordinatesService->shouldReceive('getCoordinates')->once()->with($second)->andReturnNull();

        (new LocateEventsJob())->handle($repository, $coordinatesService);

        $this->addToAssertionCount(Mockery::getContainer()->mockery_getExpectationCount());
    }
}
