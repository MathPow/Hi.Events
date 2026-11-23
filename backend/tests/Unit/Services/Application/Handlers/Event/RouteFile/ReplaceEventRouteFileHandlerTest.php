<?php

namespace Tests\Unit\Services\Application\Handlers\Event\RouteFile;

use HiEvents\DomainObjects\EventRouteFileDomainObject;
use HiEvents\Exceptions\InvalidRouteFileException;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Repository\Interfaces\EventRouteFileRepositoryInterface;
use HiEvents\Services\Application\Handlers\Event\RouteFile\DTO\ReplaceEventRouteFileDTO;
use HiEvents\Services\Application\Handlers\Event\RouteFile\ReplaceEventRouteFileHandler;
use HiEvents\Services\Domain\Event\RouteFile\EventRouteFileService;
use HiEvents\Services\Domain\Event\RouteFile\GpxFileValidator;
use Illuminate\Http\UploadedFile;
use Mockery as m;
use Mockery\MockInterface;
use Tests\TestCase;

class ReplaceEventRouteFileHandlerTest extends TestCase
{
    private EventRouteFileRepositoryInterface|MockInterface $repository;
    private EventRouteFileService|MockInterface $service;
    private GpxFileValidator|MockInterface $validator;
    private ReplaceEventRouteFileHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->repository = m::mock(EventRouteFileRepositoryInterface::class);
        $this->service = m::mock(EventRouteFileService::class);
        $this->validator = m::mock(GpxFileValidator::class);
        $this->handler = new ReplaceEventRouteFileHandler($this->repository, $this->service, $this->validator);
    }

    protected function tearDown(): void
    {
        $this->addToAssertionCount(m::getContainer()->mockery_getExpectationCount());
        m::close();
        parent::tearDown();
    }

    public function test_the_course_of_the_event_gets_the_new_file(): void
    {
        $file = UploadedFile::fake()->createWithContent('Boucle 5 km.gpx', '<gpx version="1.1"/>');
        $existing = (new EventRouteFileDomainObject())->setId(3)->setEventId(12)->setLabel('Boucle 5 km');
        $replaced = (new EventRouteFileDomainObject())->setId(3)->setEventId(12)->setLabel('Boucle du lac');

        $this->repository->shouldReceive('findFirstWhere')->once()->with(['id' => 3, 'event_id' => 12])->andReturn($existing);
        $this->validator->shouldReceive('validate')->once()->with($file);
        $this->service->shouldReceive('replace')->once()->with($existing, $file, 'Boucle du lac')->andReturn($replaced);

        $result = $this->handler->handle(new ReplaceEventRouteFileDTO(eventId: 12, routeFileId: 3, file: $file, label: 'Boucle du lac'));

        $this->assertSame($replaced, $result);
    }

    public function test_a_course_of_another_event_is_not_found(): void
    {
        $file = UploadedFile::fake()->createWithContent('route.gpx', '<gpx version="1.1"/>');

        $this->repository->shouldReceive('findFirstWhere')->once()->with(['id' => 3, 'event_id' => 99])->andReturnNull();
        $this->validator->shouldNotReceive('validate');
        $this->service->shouldNotReceive('replace');

        $this->expectException(ResourceNotFoundException::class);

        $this->handler->handle(new ReplaceEventRouteFileDTO(eventId: 99, routeFileId: 3, file: $file));
    }

    public function test_an_invalid_file_leaves_the_course_as_it_was(): void
    {
        $file = UploadedFile::fake()->createWithContent('route.gpx', 'not xml');
        $existing = (new EventRouteFileDomainObject())->setId(3)->setEventId(12);

        $this->repository->shouldReceive('findFirstWhere')->once()->andReturn($existing);
        $this->validator->shouldReceive('validate')->once()->andThrow(new InvalidRouteFileException('invalid'));
        $this->service->shouldNotReceive('replace');

        $this->expectException(InvalidRouteFileException::class);

        $this->handler->handle(new ReplaceEventRouteFileDTO(eventId: 12, routeFileId: 3, file: $file));
    }
}
