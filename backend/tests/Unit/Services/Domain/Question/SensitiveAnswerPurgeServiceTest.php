<?php

namespace Tests\Unit\Services\Domain\Question;

use Carbon\Carbon;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\QuestionDomainObject;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\QuestionAnswerRepositoryInterface;
use HiEvents\Repository\Interfaces\QuestionRepositoryInterface;
use HiEvents\Services\Domain\Question\SensitiveAnswerPurgeService;
use Illuminate\Support\Collection;
use Mockery as m;
use Tests\TestCase;

class SensitiveAnswerPurgeServiceTest extends TestCase
{
    private EventRepositoryInterface $eventRepository;
    private QuestionRepositoryInterface $questionRepository;
    private QuestionAnswerRepositoryInterface $questionAnswerRepository;
    private SensitiveAnswerPurgeService $service;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-12-01 12:00:00');

        $this->eventRepository = m::mock(EventRepositoryInterface::class);
        $this->questionRepository = m::mock(QuestionRepositoryInterface::class);
        $this->questionAnswerRepository = m::mock(QuestionAnswerRepositoryInterface::class);

        $this->eventRepository->shouldReceive('includeDeleted')->andReturnSelf();
        $this->questionRepository->shouldReceive('includeDeleted')->andReturnSelf();
        $this->questionAnswerRepository->shouldReceive('includeDeleted')->andReturnSelf();

        $this->service = new SensitiveAnswerPurgeService(
            eventRepository: $this->eventRepository,
            questionRepository: $this->questionRepository,
            questionAnswerRepository: $this->questionAnswerRepository,
        );
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        m::close();
        parent::tearDown();
    }

    public function testErasesSensitiveAnswersOfEventsOverByTheRetentionPeriod(): void
    {
        $cutoff = '2026-11-01 12:00:00';

        $this->eventRepository->shouldReceive('findWhere')
            ->once()
            ->with([['end_date', '<', $cutoff]], ['id'])
            ->andReturn(new Collection([(new EventDomainObject())->setId(1), (new EventDomainObject())->setId(2)]));
        $this->eventRepository->shouldReceive('findWhere')
            ->once()
            ->with([['end_date', 'null', null], ['start_date', '<', $cutoff]], ['id'])
            ->andReturn(new Collection([(new EventDomainObject())->setId(2), (new EventDomainObject())->setId(3)]));

        $this->questionRepository->shouldReceive('findWhere')
            ->once()
            ->with([['is_sensitive', '=', true], ['event_id', 'in', [1, 2, 3]]], ['id'])
            ->andReturn(new Collection([(new QuestionDomainObject())->setId(10), (new QuestionDomainObject())->setId(11)]));

        $this->questionAnswerRepository->shouldReceive('updateWhere')
            ->once()
            ->with(['answer' => null], [['question_id', 'in', [10, 11]], ['answer', 'not null', null]])
            ->andReturn(7);

        $this->assertSame(7, $this->service->purgeExpiredAnswers());
    }

    public function testDoesNothingWithoutPastEvents(): void
    {
        $this->eventRepository->shouldReceive('findWhere')->twice()->andReturn(new Collection());
        $this->questionRepository->shouldNotReceive('findWhere');
        $this->questionAnswerRepository->shouldNotReceive('updateWhere');

        $this->assertSame(0, $this->service->purgeExpiredAnswers());
    }

    public function testDoesNothingWhenPastEventsHaveNoSensitiveQuestion(): void
    {
        $this->eventRepository->shouldReceive('findWhere')
            ->twice()
            ->andReturn(new Collection([(new EventDomainObject())->setId(1)]));
        $this->questionRepository->shouldReceive('findWhere')->once()->andReturn(new Collection());
        $this->questionAnswerRepository->shouldNotReceive('updateWhere');

        $this->assertSame(0, $this->service->purgeExpiredAnswers());
    }
}
