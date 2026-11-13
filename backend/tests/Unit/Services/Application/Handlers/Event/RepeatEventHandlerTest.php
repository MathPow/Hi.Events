<?php

namespace Tests\Unit\Services\Application\Handlers\Event;

use Carbon\Carbon;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\Status\EventStatus;
use HiEvents\Exceptions\RecurringEventValidationException;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\DomainObjects\OrganizerDocumentDomainObject;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerDocumentRepositoryInterface;
use HiEvents\Services\Application\Handlers\Event\DTO\RepeatEventDTO;
use HiEvents\Services\Application\Handlers\Event\RepeatEventHandler;
use HiEvents\Services\Domain\Event\DuplicateEventService;
use HiEvents\Services\Domain\Event\RecurringEvent\RecurringEventDateService;
use Illuminate\Database\DatabaseManager;
use Mockery as m;
use Psr\Log\LoggerInterface;
use ReflectionMethod;
use ReflectionParameter;
use RuntimeException;
use Tests\TestCase;

class RepeatEventHandlerTest extends TestCase
{
    private EventRepositoryInterface $eventRepository;
    private DuplicateEventService $duplicateEventService;
    private OrganizerDocumentRepositoryInterface $organizerDocumentRepository;
    private DatabaseManager $databaseManager;
    private LoggerInterface $logger;
    private RepeatEventHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-01 12:00:00', 'UTC'));

        $this->eventRepository = m::mock(EventRepositoryInterface::class);
        $this->duplicateEventService = m::mock(DuplicateEventService::class);
        $this->organizerDocumentRepository = m::mock(OrganizerDocumentRepositoryInterface::class);
        $this->organizerDocumentRepository->shouldReceive('findForEvent')->with(10)->andReturn(collect())->byDefault();
        $this->databaseManager = m::mock(DatabaseManager::class);
        $this->logger = m::mock(LoggerInterface::class);

        $this->handler = new RepeatEventHandler(
            $this->eventRepository,
            $this->duplicateEventService,
            new RecurringEventDateService(),
            $this->organizerDocumentRepository,
            $this->databaseManager,
            $this->logger,
        );
    }

    public function testDuplicatesTheEventOncePerDateAndStartsTheSeriesOnTheEvent(): void
    {
        $this->eventRepository->shouldReceive('findFirstWhere')
            ->once()
            ->with(['id' => 10, 'account_id' => 3])
            ->andReturn($this->event(seriesId: null));
        $this->databaseManager->shouldReceive('beginTransaction')->twice();
        $this->databaseManager->shouldReceive('commit')->twice();

        $this->expectDuplicate('2026-11-03 18:00:00', '2026-11-03 20:00:00', newEventId: 11);
        $this->expectDuplicate('2026-11-10 18:00:00', '2026-11-10 20:00:00', newEventId: 12);

        foreach ([11, 12] as $newEventId) {
            $this->eventRepository->shouldReceive('updateWhere')
                ->once()
                ->with(['series_id' => 10, 'status' => EventStatus::LIVE->name], ['id' => $newEventId]);
        }
        $this->eventRepository->shouldReceive('updateWhere')
            ->once()
            ->with(['series_id' => 10], ['id' => 10]);

        $result = $this->handler->handle(new RepeatEventDTO(eventId: 10, accountId: 3, dates: ['2026-11-10', '2026-11-03']));

        $this->assertSame([11, 12], $result->createdEvents->map(fn(EventDomainObject $event) => $event->getId())->all());
        $this->assertSame([10, 10], $result->createdEvents->map(fn(EventDomainObject $event) => $event->getSeriesId())->all());
        $this->assertSame(EventStatus::LIVE->name, $result->createdEvents->first()->getStatus());
        $this->assertNull($result->failedDate);
    }

    public function testTheNewDatesGetTheEventsDocumentsToSign(): void
    {
        $waiver = (new OrganizerDocumentDomainObject())->setId(7)->setEventIds([10, 3]);
        $this->eventRepository->shouldReceive('findFirstWhere')->once()->andReturn($this->event(seriesId: 4));
        $this->databaseManager->shouldReceive('beginTransaction')->once();
        $this->databaseManager->shouldReceive('commit')->once();
        $this->expectDuplicate('2026-11-03 18:00:00', '2026-11-03 20:00:00', newEventId: 11);
        $this->eventRepository->shouldReceive('updateWhere')->once();
        $this->organizerDocumentRepository->shouldReceive('findForEvent')->once()->with(10)->andReturn(collect([$waiver]));
        $this->organizerDocumentRepository->shouldReceive('syncEvents')->once()->with(7, [10, 3, 11]);

        $result = $this->handler->handle(new RepeatEventDTO(eventId: 10, accountId: 3, dates: ['2026-11-03']));

        $this->assertCount(1, $result->createdEvents);
    }

    public function testRepeatingAMemberOfASeriesKeepsItsSeriesId(): void
    {
        $this->eventRepository->shouldReceive('findFirstWhere')->once()->andReturn($this->event(seriesId: 4));
        $this->databaseManager->shouldReceive('beginTransaction')->once();
        $this->databaseManager->shouldReceive('commit')->once();
        $this->expectDuplicate('2026-11-03 18:00:00', '2026-11-03 20:00:00', newEventId: 11);
        $this->eventRepository->shouldReceive('updateWhere')
            ->once()
            ->with(['series_id' => 4, 'status' => EventStatus::LIVE->name], ['id' => 11]);

        $result = $this->handler->handle(new RepeatEventDTO(eventId: 10, accountId: 3, dates: ['2026-11-03']));

        $this->assertSame(4, $result->createdEvents->first()->getSeriesId());
    }

    public function testStopsAtTheFirstDateThatFailsAndReturnsTheCreatedOnes(): void
    {
        $this->eventRepository->shouldReceive('findFirstWhere')->once()->andReturn($this->event(seriesId: 4));
        $this->databaseManager->shouldReceive('beginTransaction')->twice();
        $this->databaseManager->shouldReceive('commit')->once();
        $this->databaseManager->shouldReceive('rollBack')->once();
        $this->logger->shouldReceive('error')->once();

        $this->expectDuplicate('2026-11-03 18:00:00', '2026-11-03 20:00:00', newEventId: 11);
        $this->duplicateEventService->shouldReceive('duplicateEvent')
            ->once()
            ->withArgs(fn(...$args) => $this->named($args)['startDate'] === '2026-11-10 18:00:00')
            ->andThrow(new RuntimeException('Database went away'));
        $this->duplicateEventService->shouldNotReceive('duplicateEvent')
            ->withArgs(fn(...$args) => $this->named($args)['startDate'] === '2026-11-17 18:00:00');
        $this->eventRepository->shouldReceive('updateWhere')->once()->with(m::any(), ['id' => 11]);

        $result = $this->handler->handle(new RepeatEventDTO(
            eventId: 10,
            accountId: 3,
            dates: ['2026-11-03', '2026-11-10', '2026-11-17'],
        ));

        $this->assertCount(1, $result->createdEvents);
        $this->assertSame(11, $result->createdEvents->first()->getId());
        $this->assertSame('2026-11-10', $result->failedDate);
    }

    public function testInvalidDatesCreateNothing(): void
    {
        $this->eventRepository->shouldReceive('findFirstWhere')->once()->andReturn($this->event(seriesId: null));
        $this->duplicateEventService->shouldNotReceive('duplicateEvent');
        $this->eventRepository->shouldNotReceive('updateWhere');

        $this->expectException(RecurringEventValidationException::class);

        $this->handler->handle(new RepeatEventDTO(eventId: 10, accountId: 3, dates: ['2026-11-03', '2026-09-01']));
    }

    public function testAnEventOfAnotherAccountIsNotFound(): void
    {
        $this->eventRepository->shouldReceive('findFirstWhere')->once()->andReturnNull();
        $this->duplicateEventService->shouldNotReceive('duplicateEvent');

        $this->expectException(ResourceNotFoundException::class);

        $this->handler->handle(new RepeatEventDTO(eventId: 10, accountId: 99, dates: ['2026-11-03']));
    }

    private function expectDuplicate(string $startDate, string $endDate, int $newEventId): void
    {
        $this->duplicateEventService->shouldReceive('duplicateEvent')
            ->once()
            ->withArgs(fn(...$args) => array_intersect_key($this->named($args), array_flip([
                    'eventId', 'accountId', 'title', 'startDate', 'description', 'endDate', 'shiftRelatedDates',
                ])) == [
                    'eventId' => 10,
                    'accountId' => 3,
                    'title' => 'Course du mardi soir',
                    'startDate' => $startDate,
                    'description' => '<p>5 km</p>',
                    'endDate' => $endDate,
                    'shiftRelatedDates' => true,
                ])
            ->andReturn((new EventDomainObject())
                ->setId($newEventId)
                ->setAccountId(3)
                ->setStatus(EventStatus::DRAFT->name));
    }

    // The mock receives positional arguments: named after duplicateEvent's parameters.
    private function named(array $args): array
    {
        $names = array_map(
            static fn(ReflectionParameter $parameter) => $parameter->getName(),
            (new ReflectionMethod(DuplicateEventService::class, 'duplicateEvent'))->getParameters(),
        );

        return array_combine(array_slice($names, 0, count($args)), $args);
    }

    private function event(?int $seriesId): EventDomainObject
    {
        // Tuesday 27 October 2026, 18:00 → 20:00 in Toronto
        return (new EventDomainObject())
            ->setId(10)
            ->setAccountId(3)
            ->setTitle('Course du mardi soir')
            ->setDescription('<p>5 km</p>')
            ->setStatus(EventStatus::LIVE->name)
            ->setTimezone('America/Toronto')
            ->setStartDate('2026-10-27 22:00:00')
            ->setEndDate('2026-10-28 00:00:00')
            ->setSeriesId($seriesId);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        m::close();
        parent::tearDown();
    }
}
