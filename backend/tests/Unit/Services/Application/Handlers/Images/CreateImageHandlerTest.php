<?php

namespace Tests\Unit\Services\Application\Handlers\Images;

use HiEvents\DomainObjects\Enums\ImageType;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\ImageDomainObject;
use HiEvents\DomainObjects\UserDomainObject;
use HiEvents\Exceptions\ImageLimitReachedException;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\ImageRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use HiEvents\Services\Application\Handlers\Images\CreateImageHandler;
use HiEvents\Services\Application\Handlers\Images\DTO\CreateImageDTO;
use HiEvents\Services\Domain\Image\ImageUploadService;
use Illuminate\Http\UploadedFile;
use Mockery as m;
use Tests\TestCase;

class CreateImageHandlerTest extends TestCase
{
    private ImageUploadService $imageUploadService;
    private EventRepositoryInterface $eventRepository;
    private ImageRepositoryInterface $imageRepository;
    private CreateImageHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->imageUploadService = m::mock(ImageUploadService::class);
        $organizerRepository = m::mock(OrganizerRepositoryInterface::class);
        $this->eventRepository = m::mock(EventRepositoryInterface::class);
        $this->imageRepository = m::mock(ImageRepositoryInterface::class);

        $this->handler = new CreateImageHandler(
            $this->imageUploadService,
            $organizerRepository,
            $this->eventRepository,
            $this->imageRepository
        );
    }

    public function testHandleSuccessfullyCreatesImage(): void
    {
        $uploadedFile = m::mock(UploadedFile::class);
        $imageDomainObject = m::mock(ImageDomainObject::class);
        $accountId = 123;

        $dto = new CreateImageDTO(
            userId: 42,
            accountId: $accountId,
            image: $uploadedFile
        );

        $this->imageUploadService
            ->shouldReceive('upload')
            ->once()
            ->withArgs([
                $uploadedFile,
                42,
                UserDomainObject::class,
                ImageType::GENERIC->name,
                $accountId,
            ])
            ->andReturn($imageDomainObject);

        $result = $this->handler->handle($dto);

        $this->assertSame($imageDomainObject, $result);
    }

    public function testAGalleryPhotoIsAddedNextToThePreviousOnes(): void
    {
        $uploadedFile = m::mock(UploadedFile::class);
        $imageDomainObject = m::mock(ImageDomainObject::class);
        $this->eventRepository->shouldReceive('findById')->with(7)->andReturn((new EventDomainObject())->setAccountId(123));

        $this->imageRepository->shouldReceive('countWhere')->once()->with([
            'entity_id' => 7,
            'entity_type' => EventDomainObject::class,
            'type' => ImageType::EVENT_GALLERY->name,
        ])->andReturn(CreateImageHandler::MAX_EVENT_GALLERY_IMAGES - 1);
        $this->imageRepository->shouldNotReceive('deleteWhere');

        $this->imageUploadService->shouldReceive('upload')->once()->withArgs([
            $uploadedFile,
            7,
            EventDomainObject::class,
            ImageType::EVENT_GALLERY->name,
            123,
        ])->andReturn($imageDomainObject);

        $result = $this->handler->handle(new CreateImageDTO(
            userId: 42,
            accountId: 123,
            image: $uploadedFile,
            imageType: ImageType::EVENT_GALLERY,
            entityId: 7,
        ));

        $this->assertSame($imageDomainObject, $result);
    }

    public function testAFullGalleryRefusesAnotherPhoto(): void
    {
        $this->eventRepository->shouldReceive('findById')->with(7)->andReturn((new EventDomainObject())->setAccountId(123));
        $this->imageRepository->shouldReceive('countWhere')->once()->andReturn(CreateImageHandler::MAX_EVENT_GALLERY_IMAGES);
        $this->imageUploadService->shouldNotReceive('upload');

        $this->expectException(ImageLimitReachedException::class);

        $this->handler->handle(new CreateImageDTO(
            userId: 42,
            accountId: 123,
            image: m::mock(UploadedFile::class),
            imageType: ImageType::EVENT_GALLERY,
            entityId: 7,
        ));
    }

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }
}
