<?php

namespace Tests\Unit\Services\Domain\Event;

use HiEvents\DomainObjects\Enums\ImageType;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\ImageDomainObject;
use HiEvents\Repository\Interfaces\AffiliateRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\ImageRepositoryInterface;
use HiEvents\Services\Domain\CapacityAssignment\CreateCapacityAssignmentService;
use HiEvents\Services\Domain\CheckInList\CreateCheckInListService;
use HiEvents\Services\Domain\CreateWebhookService;
use HiEvents\Services\Domain\Event\CreateEventService;
use HiEvents\Services\Domain\Event\DuplicateEventService;
use HiEvents\Services\Domain\Event\RecurringEvent\RecurringEventDateService;
use HiEvents\Services\Domain\Event\RouteFile\EventRouteFileService;
use HiEvents\Services\Domain\Product\CreateProductService;
use HiEvents\Services\Domain\ProductCategory\CreateProductCategoryService;
use HiEvents\Services\Domain\PromoCode\CreatePromoCodeService;
use HiEvents\Services\Domain\Question\CreateQuestionService;
use HiEvents\Services\Infrastructure\HtmlPurifier\HtmlPurifierService;
use Illuminate\Support\Collection;
use Illuminate\Database\DatabaseManager;
use Mockery as m;
use Tests\TestCase;

class DuplicateEventServiceGalleryTest extends TestCase
{
    protected function tearDown(): void
    {
        $this->addToAssertionCount(m::getContainer()->mockery_getExpectationCount());
        m::close();
        parent::tearDown();
    }

    public function test_the_photos_follow_the_duplicated_event_in_their_order(): void
    {
        $source = $this->event(12)->setImages(new Collection([
            $this->image(9, ImageType::EVENT_GALLERY->name, 'events/b.jpg'),
            $this->image(3, ImageType::EVENT_COVER->name, 'events/cover.jpg'),
            $this->image(5, ImageType::EVENT_GALLERY->name, 'events/a.jpg'),
            $this->image(4, ImageType::TICKET_LOGO->name, 'events/logo.png'),
        ]));
        $copy = $this->event(34);

        $eventRepository = m::mock(EventRepositoryInterface::class);
        $eventRepository->shouldReceive('loadRelation')->andReturnSelf();
        $eventRepository->shouldReceive('findFirstWhere')->with(['id' => '12', 'account_id' => '1'])->andReturn($source);
        $eventRepository->shouldReceive('findFirstWhere')->with(['id' => 34, 'account_id' => 1])->andReturn($copy);

        $createEventService = m::mock(CreateEventService::class);
        $createEventService->shouldReceive('createEvent')->once()->andReturn($copy);

        $purifier = m::mock(HtmlPurifierService::class);
        $purifier->shouldReceive('purify')->andReturnUsing(fn(?string $html) => $html);

        $categoryService = m::mock(CreateProductCategoryService::class);
        $categoryService->shouldReceive('createDefaultProductCategory')->once();

        $databaseManager = m::mock(DatabaseManager::class);
        $databaseManager->shouldReceive('beginTransaction')->once();
        $databaseManager->shouldReceive('commit')->once();
        $databaseManager->shouldNotReceive('rollBack');

        $routeFileService = m::mock(EventRouteFileService::class);
        $routeFileService->shouldReceive('duplicateForEvent')->once()->with(12, 34);

        $recurringEventDateService = m::mock(RecurringEventDateService::class);
        $recurringEventDateService->shouldReceive('keepRelatedDates')->once()->with($source);
        $recurringEventDateService->shouldNotReceive('shiftRelatedDates');

        $created = [];
        $imageRepository = m::mock(ImageRepositoryInterface::class);
        $imageRepository->shouldReceive('create')->times(3)->andReturnUsing(function (array $attributes) use (&$created) {
            $created[] = $attributes;
            return new ImageDomainObject();
        });

        $service = new DuplicateEventService(
            eventRepository: $eventRepository,
            createEventService: $createEventService,
            createProductService: m::mock(CreateProductService::class),
            createQuestionService: m::mock(CreateQuestionService::class),
            createPromoCodeService: m::mock(CreatePromoCodeService::class),
            createCapacityAssignmentService: m::mock(CreateCapacityAssignmentService::class),
            createCheckInListService: m::mock(CreateCheckInListService::class),
            imageRepository: $imageRepository,
            databaseManager: $databaseManager,
            purifier: $purifier,
            createProductCategoryService: $categoryService,
            createWebhookService: m::mock(CreateWebhookService::class),
            affiliateRepository: m::mock(AffiliateRepositoryInterface::class),
            recurringEventDateService: $recurringEventDateService,
            eventRouteFileService: $routeFileService,
        );

        $result = $service->duplicateEvent(
            eventId: '12',
            accountId: '1',
            title: 'Trail des Laurentides 2027',
            startDate: '2027-06-12 08:00:00',
            duplicateProducts: false,
            duplicateQuestions: false,
            duplicateSettings: false,
            duplicatePromoCodes: false,
            duplicateCapacityAssignments: false,
            duplicateCheckInLists: false,
            duplicateEventCoverImage: true,
            duplicateTicketLogo: false,
            duplicateWebhooks: false,
            duplicateAffiliates: false,
        );

        $this->assertSame($copy, $result);
        $this->assertSame(['events/cover.jpg', 'events/a.jpg', 'events/b.jpg'], array_column($created, 'path'));
        $this->assertSame([34, 34, 34], array_column($created, 'entity_id'));
        $this->assertSame(ImageType::EVENT_GALLERY->name, $created[1]['type']);
        $this->assertSame(1, $created[1]['account_id']);
        $this->assertSame(1200, $created[1]['width']);
        $this->assertSame('data:image/webp;base64,AAA', $created[1]['lqip_base64']);
    }

    private function image(int $id, string $type, string $path): ImageDomainObject
    {
        return (new ImageDomainObject())
            ->setId($id)
            ->setAccountId(1)
            ->setType($type)
            ->setPath($path)
            ->setDisk('public')
            ->setFilename(basename($path))
            ->setSize(1000)
            ->setMimeType('image/jpeg')
            ->setWidth(1200)
            ->setHeight(800)
            ->setAvgColour('#aabbcc')
            ->setLqipBase64('data:image/webp;base64,AAA');
    }

    private function event(int $id): EventDomainObject
    {
        return (new EventDomainObject())
            ->setId($id)
            ->setAccountId(1)
            ->setUserId(1)
            ->setOrganizerId(1)
            ->setTitle('Trail des Laurentides')
            ->setCurrency('CAD')
            ->setTimezone('America/Toronto')
            ->setStatus('LIVE');
    }
}
