<?php

namespace HiEvents\Services\Domain\EventChange;

use Carbon\Carbon;
use HiEvents\DomainObjects\EventDateChangeDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\Generated\AttendeeCheckInDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\EventChangeRefundDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\EventDateChangeDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\OrderDomainObjectAbstract;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Exceptions\InvalidRefundRequestTokenException;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\AttendeeCheckInRepositoryInterface;
use HiEvents\Repository\Interfaces\EventChangeRefundRepositoryInterface;
use HiEvents\Repository\Interfaces\EventDateChangeRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Services\Application\Handlers\EventChange\DTO\RefundRequestDTO;
use HiEvents\Services\Domain\EventChange\DTO\RefundRequestContextDTO;
use HiEvents\Services\Domain\EventChange\Enums\RefundRequestRefusal;

/**
 * « Je ne peux plus venir : me faire rembourser »: finds the order and the change of date behind a
 * signed link, and says why a refund can't be given (null when it can).
 */
class RefundRequestService
{
    public function __construct(
        private readonly EventRepositoryInterface             $eventRepository,
        private readonly EventDateChangeRepositoryInterface   $eventDateChangeRepository,
        private readonly EventChangeRefundRepositoryInterface $eventChangeRefundRepository,
        private readonly AttendeeCheckInRepositoryInterface   $attendeeCheckInRepository,
        private readonly EventOrderRefundService              $eventOrderRefundService,
        private readonly RefundRequestTokenService            $tokenService,
    )
    {
    }

    /**
     * @throws InvalidRefundRequestTokenException
     */
    public function resolve(RefundRequestDTO $dto): RefundRequestContextDTO
    {
        /** @var EventDateChangeDomainObject|null $dateChange */
        $dateChange = $this->eventDateChangeRepository->findFirstWhere([
            EventDateChangeDomainObjectAbstract::ID => $dto->dateChangeId,
            EventDateChangeDomainObjectAbstract::EVENT_ID => $dto->eventId,
        ]);

        $order = $dateChange === null ? null : $this->eventOrderRefundService->findOrder([
            OrderDomainObjectAbstract::EVENT_ID => $dto->eventId,
            OrderDomainObjectAbstract::SHORT_ID => $dto->orderShortId,
        ]);

        if ($order === null || !$this->tokenService->isValid($order->getId(), $dateChange->getId(), $dto->token)) {
            throw new InvalidRefundRequestTokenException(__('This refund link is not valid.'));
        }

        $event = $this->eventRepository
            ->loadRelation(new Relationship(OrganizerDomainObject::class, name: 'organizer'))
            ->loadRelation(EventSettingDomainObject::class)
            ->findById($dto->eventId);

        return new RefundRequestContextDTO(
            event: $event,
            dateChange: $dateChange,
            order: $order,
            refund: $this->eventChangeRefundRepository->findFirstWhere([
                EventChangeRefundDomainObjectAbstract::ORDER_ID => $order->getId(),
                EventChangeRefundDomainObjectAbstract::EVENT_DATE_CHANGE_ID => $dateChange->getId(),
            ]),
        );
    }

    public function refusal(RefundRequestContextDTO $context): ?RefundRequestRefusal
    {
        $order = $context->order;
        $dateChange = $context->dateChange;

        if ($order->isOrderCancelled()) {
            return RefundRequestRefusal::ALREADY_CANCELLED;
        }

        if ($this->eventOrderRefundService->isAlreadySettled($order)) {
            return RefundRequestRefusal::ALREADY_REFUNDED;
        }

        if ($context->event->isCancelled()) {
            return RefundRequestRefusal::EVENT_CANCELLED;
        }

        if ($this->latestDateChangeId($context->event->getId()) !== $dateChange->getId()) {
            return RefundRequestRefusal::LINK_REPLACED;
        }

        if (!$dateChange->getRefundsAllowed() || $dateChange->getRefundDeadline() === null) {
            return RefundRequestRefusal::REFUNDS_NOT_ALLOWED;
        }

        if (Carbon::parse($dateChange->getRefundDeadline(), 'UTC')->isPast()) {
            return RefundRequestRefusal::DEADLINE_PASSED;
        }

        if ($this->isCheckedIn($order->getId())) {
            return RefundRequestRefusal::CHECKED_IN;
        }

        return null;
    }

    private function latestDateChangeId(int $eventId): ?int
    {
        return $this->eventDateChangeRepository
            ->findWhere([EventDateChangeDomainObjectAbstract::EVENT_ID => $eventId])
            ->max(fn(EventDateChangeDomainObject $dateChange) => $dateChange->getId());
    }

    private function isCheckedIn(int $orderId): bool
    {
        return $this->attendeeCheckInRepository->findFirstWhere([
            AttendeeCheckInDomainObjectAbstract::ORDER_ID => $orderId,
        ]) !== null;
    }
}
