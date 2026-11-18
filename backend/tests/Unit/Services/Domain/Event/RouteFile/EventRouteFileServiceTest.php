<?php

namespace Tests\Unit\Services\Domain\Event\RouteFile;

use HiEvents\DomainObjects\EventRouteFileDomainObject;
use HiEvents\Exceptions\CouldNotStoreRouteFileException;
use HiEvents\Repository\Interfaces\EventRouteFileRepositoryInterface;
use HiEvents\Services\Domain\Event\RouteFile\EventRouteFileService;
use Illuminate\Config\Repository;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Filesystem\FilesystemManager;
use Illuminate\Http\UploadedFile;
use Mockery as m;
use Mockery\MockInterface;
use Psr\Log\LoggerInterface;
use Tests\TestCase;

class EventRouteFileServiceTest extends TestCase
{
    private const NEW_PATH_PATTERN = '#^events/34/routes/[0-9a-f-]{36}\.gpx$#';

    private EventRouteFileRepositoryInterface|MockInterface $repository;
    private FilesystemManager|MockInterface $filesystemManager;
    private Filesystem|MockInterface $disk;
    private LoggerInterface|MockInterface $logger;
    private EventRouteFileService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->repository = m::mock(EventRouteFileRepositoryInterface::class);
        $this->disk = m::mock(Filesystem::class);
        $this->filesystemManager = m::mock(FilesystemManager::class);
        $this->filesystemManager->shouldReceive('disk')->andReturn($this->disk);
        $this->logger = m::mock(LoggerInterface::class)->shouldIgnoreMissing();

        config(['filesystems.public' => 'public']);

        $this->service = new EventRouteFileService(
            routeFileRepository: $this->repository,
            filesystemManager: $this->filesystemManager,
            config: app(Repository::class),
            logger: $this->logger,
        );
    }

    protected function tearDown(): void
    {
        $this->addToAssertionCount(m::getContainer()->mockery_getExpectationCount());
        m::close();
        parent::tearDown();
    }

    public function test_duplication_copies_each_file_to_a_new_path_of_the_new_event(): void
    {
        $this->repository->shouldReceive('findWhere')->once()->andReturn(collect([
            $this->routeFile(1, '10 km', 'events/12/routes/aaa.gpx'),
            $this->routeFile(2, '21 km', 'events/12/routes/bbb.gpx'),
        ]));

        $copies = [];
        $this->disk->shouldReceive('exists')->twice()->andReturnTrue();
        $this->disk->shouldReceive('copy')->twice()->andReturnUsing(function (string $from, string $to) use (&$copies) {
            $copies[$from] = $to;
            return true;
        });

        $created = [];
        $this->repository->shouldReceive('create')->twice()->andReturnUsing(function (array $attributes) use (&$created) {
            $created[] = $attributes;
            return new EventRouteFileDomainObject();
        });

        $this->service->duplicateForEvent(12, 34);

        $this->assertSame(['events/12/routes/aaa.gpx', 'events/12/routes/bbb.gpx'], array_keys($copies));
        $this->assertMatchesRegularExpression(self::NEW_PATH_PATTERN, $copies['events/12/routes/aaa.gpx']);
        $this->assertMatchesRegularExpression(self::NEW_PATH_PATTERN, $copies['events/12/routes/bbb.gpx']);
        $this->assertNotSame($copies['events/12/routes/aaa.gpx'], $copies['events/12/routes/bbb.gpx']);

        $this->assertSame([
            'event_id' => 34,
            'label' => '10 km',
            'original_filename' => '10 km.gpx',
            'disk' => 'public',
            'path' => $copies['events/12/routes/aaa.gpx'],
            'size' => 2048,
        ], $created[0]);
        $this->assertSame('21 km', $created[1]['label']);
        $this->assertSame($copies['events/12/routes/bbb.gpx'], $created[1]['path']);
    }

    public function test_duplication_skips_a_file_missing_on_disk(): void
    {
        $this->repository->shouldReceive('findWhere')->once()->andReturn(collect([
            $this->routeFile(1, '10 km', 'events/12/routes/missing.gpx'),
            $this->routeFile(2, '21 km', 'events/12/routes/bbb.gpx'),
        ]));

        $this->disk->shouldReceive('exists')->with('events/12/routes/missing.gpx')->andReturnFalse();
        $this->disk->shouldReceive('exists')->with('events/12/routes/bbb.gpx')->andReturnTrue();
        $this->disk->shouldReceive('copy')->once()->with('events/12/routes/bbb.gpx', m::pattern(self::NEW_PATH_PATTERN))->andReturnTrue();
        $this->repository->shouldReceive('create')->once()->with(m::on(fn(array $attributes) => $attributes['label'] === '21 km'))
            ->andReturn(new EventRouteFileDomainObject());

        $this->service->duplicateForEvent(12, 34);
    }

    public function test_duplication_of_an_event_without_courses_copies_nothing(): void
    {
        $this->repository->shouldReceive('findWhere')->once()->andReturn(collect());
        $this->disk->shouldNotReceive('copy');
        $this->repository->shouldNotReceive('create');

        $this->service->duplicateForEvent(12, 34);
    }

    public function test_an_upload_is_stored_on_the_public_disk_under_the_event(): void
    {
        $file = UploadedFile::fake()->createWithContent('Boucle du lac.gpx', '<gpx version="1.1"/>');

        $this->disk->shouldReceive('putFileAs')->once()
            ->with('events/12/routes', $file, m::pattern('#^[0-9a-f-]{36}\.gpx$#'), [
                'ContentType' => 'application/octet-stream',
                'ContentDisposition' => 'attachment',
            ])
            ->andReturnUsing(fn(string $directory, $file, string $name) => $directory . '/' . $name);

        $this->repository->shouldReceive('create')->once()->with(m::on(function (array $attributes) {
            return $attributes['event_id'] === 12
                && $attributes['label'] === 'Boucle du lac'
                && $attributes['original_filename'] === 'Boucle du lac.gpx'
                && $attributes['disk'] === 'public'
                && preg_match('#^events/12/routes/[0-9a-f-]{36}\.gpx$#', $attributes['path']) === 1
                && $attributes['size'] === strlen('<gpx version="1.1"/>');
        }))->andReturn(new EventRouteFileDomainObject());

        $this->service->store(12, $file, null);
    }

    public function test_a_failed_upload_is_reported(): void
    {
        $this->disk->shouldReceive('putFileAs')->once()->andReturnFalse();
        $this->repository->shouldNotReceive('create');

        $this->expectException(CouldNotStoreRouteFileException::class);

        $this->service->store(12, UploadedFile::fake()->createWithContent('route.gpx', '<gpx/>'), null);
    }

    public function test_the_label_defaults_to_the_file_name_and_is_cleaned(): void
    {
        $this->assertSame('10 km', $this->service->cleanLabel(null, '10 km.gpx'));
        $this->assertSame('10 km', $this->service->cleanLabel("  \t ", '10 km.gpx'));
        $this->assertSame('Demi marathon', $this->service->cleanLabel("Demi\x00   marathon\n", 'x.gpx'));
        $this->assertSame(__('Route'), $this->service->cleanLabel('', '.gpx'));
        $this->assertSame(EventRouteFileService::LABEL_MAX_LENGTH, mb_strlen($this->service->cleanLabel(str_repeat('a', 300))));
    }

    private function routeFile(int $id, string $label, string $path): EventRouteFileDomainObject
    {
        return (new EventRouteFileDomainObject())
            ->setId($id)
            ->setEventId(12)
            ->setLabel($label)
            ->setOriginalFilename($label . '.gpx')
            ->setDisk('public')
            ->setPath($path)
            ->setSize(2048);
    }
}
