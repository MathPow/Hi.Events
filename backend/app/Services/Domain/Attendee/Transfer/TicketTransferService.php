<?php

namespace HiEvents\Services\Domain\Attendee\Transfer;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\Enums\TicketTransferRefusal;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\Generated\AttendeeDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\AttendeeTransferDomainObjectAbstract;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrderItemDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\Exceptions\TicketTransferNotAllowedException;
use HiEvents\Helper\IdHelper;
use HiEvents\Mail\Attendee\AttendeeTicketTransferredMail;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\AttendeeRepositoryInterface;
use HiEvents\Repository\Interfaces\AttendeeTransferRepositoryInterface;
use HiEvents\Services\Domain\Attendee\SendAttendeeTicketService;
use HiEvents\Services\Domain\Attendee\Transfer\DTO\TicketTransferRecipientDTO;
use HiEvents\Services\Domain\Document\OrderDocumentCopyService;
use HiEvents\Services\Domain\Question\ParticipantDetailsService;
use HiEvents\Services\Infrastructure\DomainEvents\DomainEventDispatcherService;
use HiEvents\Services\Infrastructure\DomainEvents\Enums\DomainEventType;
use HiEvents\Services\Infrastructure\DomainEvents\Events\AttendeeEvent;
use Illuminate\Database\DatabaseManager;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * A participant gives their ticket to someone else. The ticket keeps its product and bib number
 * but gets new ids, so the previous link, QR code and wallet pass stop working. What belonged to
 * the previous holder goes: their participant details, their waiver and document signatures. The
 * new holder signs themselves, from their ticket's link or at the entrance.
 */
class TicketTransferService
{
    public function __construct(
        private readonly TicketTransferPolicy                $policy,
        private readonly AttendeeRepositoryInterface         $attendeeRepository,
        private readonly AttendeeTransferRepositoryInterface $attendeeTransferRepository,
        private readonly ParticipantDetailsService           $participantDetailsService,
        private readonly OrderDocumentCopyService            $orderDocumentCopyService,
        private readonly SendAttendeeTicketService           $sendAttendeeTicketService,
        private readonly DomainEventDispatcherService        $domainEventDispatcherService,
        private readonly DatabaseManager                     $databaseManager,
    )
    {
    }

    /**
     * @param EventDomainObject $event With its settings and organizer.
     *
     * @throws TicketTransferNotAllowedException|Throwable
     */
    public function transfer(
        AttendeeDomainObject       $attendee,
        OrderDomainObject          $order,
        EventDomainObject          $event,
        TicketTransferRecipientDTO $recipient,
        ?string                    $ipAddress,
    ): AttendeeDomainObject
    {
        $settings = $event->getEventSettings();
        $this->policy->assertCanTransfer($attendee, $order, $event, $settings, $recipient->email);

        $recipient = new TicketTransferRecipientDTO(
            first_name: trim($recipient->first_name),
            last_name: trim($recipient->last_name),
            email: trim($recipient->email),
        );

        $this->databaseManager->transaction(function () use ($attendee, $recipient, $ipAddress, $order) {
            $this->updateHolder($attendee, $recipient);

            $this->participantDetailsService->eraseAnswers($attendee);

            $this->orderDocumentCopyService->deleteForAttendee($attendee->getId());
            $this->orderDocumentCopyService->replaceUnsignedForAttendee(
                $this->attendeeRepository->findById($attendee->getId()),
                null,
                $attendee->getLocale() ?: $order->getLocale() ?: app()->getLocale(),
            );

            $this->attendeeTransferRepository->create([
                AttendeeTransferDomainObjectAbstract::EVENT_ID => $attendee->getEventId(),
                AttendeeTransferDomainObjectAbstract::ATTENDEE_ID => $attendee->getId(),
                AttendeeTransferDomainObjectAbstract::FROM_FIRST_NAME => (string)$attendee->getFirstName(),
                AttendeeTransferDomainObjectAbstract::FROM_LAST_NAME => (string)$attendee->getLastName(),
                AttendeeTransferDomainObjectAbstract::FROM_EMAIL => (string)$attendee->getEmail(),
                AttendeeTransferDomainObjectAbstract::TO_FIRST_NAME => $recipient->first_name,
                AttendeeTransferDomainObjectAbstract::TO_LAST_NAME => $recipient->last_name,
                AttendeeTransferDomainObjectAbstract::TO_EMAIL => $recipient->email,
                AttendeeTransferDomainObjectAbstract::IP_ADDRESS => $ipAddress,
            ]);

            $this->domainEventDispatcherService->dispatch(new AttendeeEvent(
                type: DomainEventType::ATTENDEE_UPDATED,
                attendeeId: $attendee->getId(),
            ));
        });

        $transferred = $this->attendeeRepository
            ->loadRelation(new Relationship(OrderDomainObject::class, nested: [
                new Relationship(OrderItemDomainObject::class),
            ], name: 'order'))
            ->loadRelation(new Relationship(ProductDomainObject::class, name: 'product'))
            ->findById($attendee->getId());

        $this->sendEmails($attendee, $transferred, $event);

        return $transferred;
    }

    /**
     * The new holder, with new ids and no signature. Only the ticket as it was read may change: a
     * transfer made meanwhile from the same link leaves nothing to update.
     *
     * @throws TicketTransferNotAllowedException
     */
    private function updateHolder(AttendeeDomainObject $attendee, TicketTransferRecipientDTO $recipient): void
    {
        $updated = $this->attendeeRepository->updateWhere(
            attributes: [
                AttendeeDomainObjectAbstract::FIRST_NAME => $recipient->first_name,
                AttendeeDomainObjectAbstract::LAST_NAME => $recipient->last_name,
                AttendeeDomainObjectAbstract::EMAIL => $recipient->email,
                AttendeeDomainObjectAbstract::SHORT_ID => IdHelper::shortId(IdHelper::ATTENDEE_PREFIX),
                AttendeeDomainObjectAbstract::PUBLIC_ID => IdHelper::publicId(IdHelper::ATTENDEE_PREFIX),
                AttendeeDomainObjectAbstract::WAIVER_ID => null,
                AttendeeDomainObjectAbstract::WAIVER_SIGNED_NAME => null,
                AttendeeDomainObjectAbstract::WAIVER_GUARDIAN_NAME => null,
                AttendeeDomainObjectAbstract::WAIVER_SIGNED_AT => null,
                AttendeeDomainObjectAbstract::WAIVER_IP_ADDRESS => null,
            ],
            where: [
                AttendeeDomainObjectAbstract::ID => $attendee->getId(),
                AttendeeDomainObjectAbstract::SHORT_ID => $attendee->getShortId(),
            ],
        );

        if ($updated === 0) {
            throw new TicketTransferNotAllowedException(TicketTransferRefusal::TICKET_NOT_ACTIVE);
        }
    }

    private function sendEmails(AttendeeDomainObject $previous, AttendeeDomainObject $transferred, EventDomainObject $event): void
    {
        $order = $transferred->getOrder();

        $this->sendAttendeeTicketService->send(
            order: $order,
            attendee: $transferred,
            event: $event,
            eventSettings: $event->getEventSettings(),
            organizer: $event->getOrganizer(),
        );

        $previousEmail = (string)$previous->getEmail();
        $confirmation = fn(bool $toBuyer) => new AttendeeTicketTransferredMail(
            event: $event,
            organizer: $event->getOrganizer(),
            eventSettings: $event->getEventSettings(),
            ticketTitle: $transferred->getProduct()?->getTitle() ?? __('Ticket'),
            previousHolderName: trim($previous->getFirstName() . ' ' . $previous->getLastName()),
            newHolderName: $this->shortName($transferred->getFirstName(), $transferred->getLastName()),
            toBuyer: $toBuyer,
        );

        Mail::to($previousEmail)
            ->locale($previous->getLocale() ?: $order->getLocale())
            ->queue($confirmation(false));

        $buyerEmail = (string)$order->getEmail();
        if ($buyerEmail !== ''
            && !$this->sameEmail($buyerEmail, $previousEmail)
            && !$this->sameEmail($buyerEmail, (string)$transferred->getEmail())) {
            Mail::to($buyerEmail)
                ->locale($order->getLocale() ?: $previous->getLocale())
                ->queue($confirmation(true));
        }
    }

    /**
     * « Marie T. »: enough for the previous holder to recognize who got the ticket.
     */
    private function shortName(?string $firstName, ?string $lastName): string
    {
        $initial = mb_strtoupper(mb_substr(trim((string)$lastName), 0, 1));

        return trim(trim((string)$firstName) . ($initial !== '' ? " $initial." : ''));
    }

    private function sameEmail(string $first, string $second): bool
    {
        return mb_strtolower(trim($first)) === mb_strtolower(trim($second));
    }
}
