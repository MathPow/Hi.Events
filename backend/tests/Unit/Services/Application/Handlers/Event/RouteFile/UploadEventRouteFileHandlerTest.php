<?php

namespace Tests\Unit\Services\Application\Handlers\Event\RouteFile;

use HiEvents\DomainObjects\EventRouteFileDomainObject;
use HiEvents\Exceptions\InvalidRouteFileException;
use HiEvents\Exceptions\RouteFileLimitReachedException;
use HiEvents\Repository\Interfaces\EventRouteFileRepositoryInterface;
use HiEvents\Services\Application\Handlers\Event\RouteFile\DTO\UploadEventRouteFileDTO;
use HiEvents\Services\Application\Handlers\Event\RouteFile\UploadEventRouteFileHandler;
use HiEvents\Services\Domain\Event\RouteFile\EventRouteFileService;
use HiEvents\Services\Domain\Event\RouteFile\GpxFileValidator;
use Illuminate\Http\UploadedFile;
use Mockery as m;
use Mockery\MockInterface;
use Tests\TestCase;

class UploadEventRouteFileHandlerTest extends TestCase
{
    private EventRouteFileRepositoryInterface|MockInterface $repository;
    private EventRouteFileService|MockInterface $service;
    private GpxFileValidator|MockInterface $validator;
    private UploadEventRouteFileHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->repository = m::mock(EventRouteFileRepositoryInterface::class);
        $this->service = m::mock(EventRouteFileService::class);
        $this->validator = m::mock(GpxFileValidator::class);
        $this->handler = new UploadEventRouteFileHandler($this->repository, $this->service, $this->validator);
    }

    protected function tearDown(): void
    {
        $this->addToAssertionCount(m::getContainer()->mockery_getExpectationCount());
        m::close();
        parent::tearDown();
    }

    public function test_a_valid_file_is_stored_with_its_label(): void
    {
        $file = UploadedFile::fake()->createWithContent('10 km.gpx', '<gpx version="1.1"/>');
        $stored = (new EventRouteFileDomainObject())->setId(3)->setEventId(12)->setLabel('Boucle 10 km');

        $this->repository->shouldReceive('countWhere')->once()->with(['event_id' => 12])->andReturn(4);
        $this->validator->shouldReceive('validate')->once()->with($file);
        $this->service->shouldReceive('store')->once()->with(12, $file, 'Boucle 10 km')->andReturn($stored);

        $result = $this->handler->handle(new UploadEventRouteFileDTO(eventId: 12, file: $file, label: 'Boucle 10 km'));

        $this->assertSame($stored, $result);
    }

    public function test_a_sixth_file_is_refused_before_being_read_or_stored(): void
    {
        $file = UploadedFile::fake()->createWithContent('extra.gpx', '<gpx version="1.1"/>');

        $this->repository->shouldReceive('countWhere')->once()->andReturn(EventRouteFileService::MAX_FILES_PER_EVENT);
        $this->validator->shouldNotReceive('validate');
        $this->service->shouldNotReceive('store');

        $this->expectException(RouteFileLimitReachedException::class);

        $this->handler->handle(new UploadEventRouteFileDTO(eventId: 12, file: $file));
    }

    public function test_an_invalid_file_is_not_stored(): void
    {
        $file = UploadedFile::fake()->createWithContent('route.gpx', 'not xml');

        $this->repository->shouldReceive('countWhere')->once()->andReturn(0);
        $this->validator->shouldReceive('validate')->once()->andThrow(new InvalidRouteFileException('invalid'));
        $this->service->shouldNotReceive('store');

        $this->expectException(InvalidRouteFileException::class);

        $this->handler->handle(new UploadEventRouteFileDTO(eventId: 12, file: $file));
    }
}
