<?php

namespace HiEvents\Services\Domain\Question;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\Generated\EventDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\QuestionDomainObjectAbstract;
use HiEvents\DomainObjects\QuestionDomainObject;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\QuestionAnswerRepositoryInterface;
use HiEvents\Repository\Interfaces\QuestionRepositoryInterface;

/**
 * Erases the answers to sensitive questions (date of birth, emergency contact,
 * health) once the event is over by RETENTION_DAYS: Quebec's Law 25 keeps
 * personal information only as long as its purpose lasts. The answer is
 * emptied, the attendee and the question stay.
 */
class SensitiveAnswerPurgeService
{
    public const RETENTION_DAYS = 30;

    public function __construct(
        private readonly EventRepositoryInterface          $eventRepository,
        private readonly QuestionRepositoryInterface       $questionRepository,
        private readonly QuestionAnswerRepositoryInterface $questionAnswerRepository,
    )
    {
    }

    public function purgeExpiredAnswers(): int
    {
        $cutoff = now()->subDays(self::RETENTION_DAYS)->toDateTimeString();

        // An event without an end date is over once it has started.
        $eventIds = $this->eventRepository
            ->includeDeleted()
            ->findWhere([[EventDomainObjectAbstract::END_DATE, '<', $cutoff]], columns: ['id'])
            ->merge($this->eventRepository
                ->includeDeleted()
                ->findWhere([
                    [EventDomainObjectAbstract::END_DATE, 'null', null],
                    [EventDomainObjectAbstract::START_DATE, '<', $cutoff],
                ], columns: ['id']))
            ->map(fn(EventDomainObject $event) => $event->getId())
            ->unique()
            ->values()
            ->all();

        if ($eventIds === []) {
            return 0;
        }

        $questionIds = $this->questionRepository
            ->includeDeleted()
            ->findWhere([
                [QuestionDomainObjectAbstract::IS_SENSITIVE, '=', true],
                [QuestionDomainObjectAbstract::EVENT_ID, 'in', $eventIds],
            ], columns: ['id'])
            ->map(fn(QuestionDomainObject $question) => $question->getId())
            ->all();

        if ($questionIds === []) {
            return 0;
        }

        return $this->questionAnswerRepository->includeDeleted()->updateWhere(
            attributes: ['answer' => null],
            where: [
                ['question_id', 'in', $questionIds],
                ['answer', 'not null', null],
            ],
        );
    }
}
