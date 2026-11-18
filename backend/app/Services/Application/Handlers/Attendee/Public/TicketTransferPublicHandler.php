<?php

namespace HiEvents\Services\Application\Handlers\Attendee\Public;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\Generated\AttendeeDomainObjectAbstract;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\QuestionDomainObject;
use HiEvents\Exceptions\TicketTransferNotAllowedException;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\AttendeeRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Application\Handlers\Attendee\Public\DTO\TransferTicketPublicDTO;
use HiEvents\Services\Domain\Attendee\Transfer\DTO\TicketTransferEligibilityDTO;
use HiEvents\Services\Domain\Attendee\Transfer\DTO\TicketTransferRecipientDTO;
use HiEvents\Services\Domain\Attendee\Transfer\TicketTransferPolicy;
use HiEvents\Services\Domain\Attendee\Transfer\TicketTransferService;
use HiEvents\Services\Domain\Attendee\Transfer\TransferredHolderDetailsService;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;
use Throwable;

/**
 * A participant gives their ticket to someone else, from their ticket's link (or the buyer, from
 * the order page, which lists every ticket's link). The new holder then gives their own
 * participant details from the new link.
 */
class TicketTransferPublicHandler
{
    public function __construct(
        private readonly AttendeeRepositoryInterface $attendeeRepository,
        private readonly OrderRepositoryInterface    $orderRepository,
        private readonly EventRepositoryInterface    $eventRepository,
        private readonly TicketTransferPolicy        $policy,
        private readonly TicketTransferService       $transferService,
        private readonly TransferredHolderDetailsService $holderDetailsService,
    )
    {
    }

    public function eligibility(int $eventId, string $attendeeShortId): TicketTransferEligibilityDTO
    {
        $attendee = $this->findAttendee($eventId, $attendeeShortId);
        $event = $this->findEvent($eventId);

        return $this->policy->eligibility(
            $attendee,
            $this->orderRepository->findById($attendee->getOrderId()),
            $event,
            $event->getEventSettings(),
        );
    }

    /**
     * @throws TicketTransferNotAllowedException|Throwable
     */
    public function transfer(TransferTicketPublicDTO $dto): void
    {
        $attendee = $this->findAttendee($dto->eventId, $dto->attendeeShortId);

        $this->transferService->transfer(
            attendee: $attendee,
            order: $this->orderRepository->findById($attendee->getOrderId()),
            event: $this->findEvent($dto->eventId),
            recipient: new TicketTransferRecipientDTO(
                first_name: $dto->firstName,
                last_name: $dto->lastName,
                email: $dto->email,
            ),
            ipAddress: $dto->ipAddress,
        );
    }

    /**
     * @return Collection<int, QuestionDomainObject>
     */
    public function pendingDetails(int $eventId, string $attendeeShortId): Collection
    {
        return $this->holderDetailsService->pendingQuestions(
            $this->findAttendee($eventId, $attendeeShortId),
            $this->eventRepository->findById($eventId),
        );
    }

    /**
     * @throws ValidationException|Throwable
     */
    public function completeDetails(int $eventId, string $attendeeShortId, array $input): void
    {
        $attendee = $this->findAttendee($eventId, $attendeeShortId);

        $this->holderDetailsService->complete(
            $attendee,
            $this->eventRepository->findById($eventId),
            $input,
            $attendee->getLocale() ?: app()->getLocale(),
        );
    }

    private function findAttendee(int $eventId, string $attendeeShortId): AttendeeDomainObject
    {
        $attendee = $this->attendeeRepository->findFirstWhere([
            AttendeeDomainObjectAbstract::SHORT_ID => $attendeeShortId,
            AttendeeDomainObjectAbstract::EVENT_ID => $eventId,
        ]);

        if (!$attendee) {
            throw new ResourceNotFoundException(__('Attendee not found'));
        }

        return $attendee;
    }

    private function findEvent(int $eventId): EventDomainObject
    {
        return $this->eventRepository
            ->loadRelation(new Relationship(OrganizerDomainObject::class, name: 'organizer'))
            ->loadRelation(EventSettingDomainObject::class)
            ->findById($eventId);
    }
}
