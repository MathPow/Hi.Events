<?php

namespace Tests\Unit\Services\Domain\Event;

use HiEvents\DomainObjects\EventDomainObject;
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
use Illuminate\Database\DatabaseManager;
use Mockery as m;
use Tests\TestCase;

class DuplicateEventServiceRouteFilesTest extends TestCase
{
    protected function tearDown(): void
    {
        $this->addToAssertionCount(m::getContainer()->mockery_getExpectationCount());
        m::close();
        parent::tearDown();
    }

    public function test_the_courses_follow_the_duplicated_event(): void
    {
        $source = $this->event(12);
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

        // A plain duplicate keeps the related dates where they are, as local times
        $recurringEventDateService = m::mock(RecurringEventDateService::class);
        $recurringEventDateService->shouldReceive('keepRelatedDates')->once()->with($source);
        $recurringEventDateService->shouldNotReceive('shiftRelatedDates');

        $service = new DuplicateEventService(
            eventRepository: $eventRepository,
            createEventService: $createEventService,
            createProductService: m::mock(CreateProductService::class),
            createQuestionService: m::mock(CreateQuestionService::class),
            createPromoCodeService: m::mock(CreatePromoCodeService::class),
            createCapacityAssignmentService: m::mock(CreateCapacityAssignmentService::class),
            createCheckInListService: m::mock(CreateCheckInListService::class),
            imageRepository: m::mock(ImageRepositoryInterface::class),
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
            duplicateEventCoverImage: false,
            duplicateTicketLogo: false,
            duplicateWebhooks: false,
            duplicateAffiliates: false,
        );

        $this->assertSame($copy, $result);
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
