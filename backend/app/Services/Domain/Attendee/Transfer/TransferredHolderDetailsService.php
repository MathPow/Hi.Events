<?php

namespace HiEvents\Services\Domain\Attendee\Transfer;

use Carbon\CarbonImmutable;
use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\AttendeeTransferDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\Generated\AttendeeTransferDomainObjectAbstract;
use HiEvents\DomainObjects\QuestionDomainObject;
use HiEvents\DomainObjects\Status\AttendeeStatus;
use HiEvents\Repository\Interfaces\AttendeeTransferRepositoryInterface;
use HiEvents\Services\Domain\Document\OrderDocumentCopyService;
use HiEvents\Services\Domain\Question\ParticipantDetailsService;
use Illuminate\Database\DatabaseManager;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * The participant details a transfer erased: the new holder gives their own from their ticket's
 * page, before the event. Their date of birth then decides which documents they sign, and whether
 * a parent signs with them.
 */
class TransferredHolderDetailsService
{
    public function __construct(
        private readonly AttendeeTransferRepositoryInterface $attendeeTransferRepository,
        private readonly ParticipantDetailsService           $participantDetailsService,
        private readonly OrderDocumentCopyService            $orderDocumentCopyService,
        private readonly DatabaseManager                     $databaseManager,
    )
    {
    }

    /**
     * The questions the new holder has yet to answer; none once they did, or for a ticket that
     * was not transferred.
     *
     * @return Collection<int, QuestionDomainObject>
     */
    public function pendingQuestions(AttendeeDomainObject $attendee, EventDomainObject $event): Collection
    {
        if ($attendee->getStatus() !== AttendeeStatus::ACTIVE->name || $this->hasStarted($event)) {
            return collect();
        }

        $transfer = $this->latestTransfer($attendee);

        if ($transfer === null || $transfer->getDetailsCompletedAt() !== null) {
            return collect();
        }

        return $this->participantDetailsService->questionsFor($attendee);
    }

    /**
     * @throws ValidationException|Throwable
     */
    public function complete(AttendeeDomainObject $attendee, EventDomainObject $event, array $input, string $locale): void
    {
        $questions = $this->pendingQuestions($attendee, $event);

        if ($questions->isEmpty()) {
            return;
        }

        $this->databaseManager->transaction(function () use ($attendee, $questions, $input, $locale) {
            $this->participantDetailsService->saveAnswers($attendee, $questions, $input);

            $this->orderDocumentCopyService->replaceUnsignedForAttendee(
                $attendee,
                $this->participantDetailsService->dateOfBirth($questions, $input),
                $locale,
            );

            $this->attendeeTransferRepository->updateFromArray($this->latestTransfer($attendee)->getId(), [
                AttendeeTransferDomainObjectAbstract::DETAILS_COMPLETED_AT => now()->toDateTimeString(),
            ]);
        });
    }

    private function latestTransfer(AttendeeDomainObject $attendee): ?AttendeeTransferDomainObject
    {
        return $this->attendeeTransferRepository
            ->findWhere([AttendeeTransferDomainObjectAbstract::ATTENDEE_ID => $attendee->getId()])
            ->sortByDesc(fn(AttendeeTransferDomainObject $transfer) => $transfer->getId())
            ->first();
    }

    private function hasStarted(EventDomainObject $event): bool
    {
        return $event->getStartDate() !== null
            && CarbonImmutable::parse($event->getStartDate(), 'UTC')->isPast();
    }
}
