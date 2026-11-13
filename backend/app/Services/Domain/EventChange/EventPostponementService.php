<?php

namespace HiEvents\Services\Domain\EventChange;

use Carbon\Carbon;
use HiEvents\DomainObjects\EventDateChangeDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\Generated\EventDateChangeDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\EventDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\ProductDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\ProductPriceDomainObjectAbstract;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use HiEvents\Exceptions\EventChangeNotAllowedException;
use HiEvents\Repository\Interfaces\EventDateChangeRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\ProductPriceRepositoryInterface;
use HiEvents\Repository\Interfaces\ProductRepositoryInterface;
use HiEvents\Services\Application\Handlers\EventChange\DTO\PostponeEventDTO;

/**
 * Moves an event to a new date (« Reporter l'événement »): the event's dates, the end of sales that
 * were open until the event (moved by as much, so tickets stay on sale until the new date), and a
 * record of the change with the message and the refund deadline. The caller holds the transaction.
 */
class EventPostponementService
{
    public const DEFAULT_REFUND_DEADLINE_HOURS = 48;

    private const DATE_FORMAT = 'Y-m-d H:i:s';

    public function __construct(
        private readonly EventRepositoryInterface           $eventRepository,
        private readonly ProductRepositoryInterface         $productRepository,
        private readonly ProductPriceRepositoryInterface    $productPriceRepository,
        private readonly EventDateChangeRepositoryInterface $eventDateChangeRepository,
    )
    {
    }

    /**
     * @throws EventChangeNotAllowedException
     */
    public function postpone(EventDomainObject $event, PostponeEventDTO $dto): EventDateChangeDomainObject
    {
        if ($event->isCancelled()) {
            throw new EventChangeNotAllowedException(__('This event is cancelled: it cannot be postponed.'));
        }

        $timezone = $event->getTimezone() ?: 'UTC';
        $oldStart = Carbon::parse($event->getStartDate(), 'UTC');
        $oldEnd = $event->getEndDate() ? Carbon::parse($event->getEndDate(), 'UTC') : null;
        $newStart = Carbon::parse($dto->startDate, $timezone)->utc();
        $newEnd = $dto->endDate ? Carbon::parse($dto->endDate, $timezone)->utc() : null;

        if ($newStart->isPast()) {
            throw new EventChangeNotAllowedException(__('The new date must be in the future.'));
        }

        if ($newEnd !== null && $newEnd->lessThanOrEqualTo($newStart)) {
            throw new EventChangeNotAllowedException(__('The end must be after the start.'));
        }

        $refundDeadline = $dto->refundsAllowed ? $this->refundDeadline($dto, $newStart, $timezone) : null;

        $this->eventRepository->updateWhere(
            attributes: [
                EventDomainObjectAbstract::START_DATE => $newStart->format(self::DATE_FORMAT),
                EventDomainObjectAbstract::END_DATE => $newEnd?->format(self::DATE_FORMAT),
            ],
            where: [EventDomainObjectAbstract::ID => $event->getId()],
        );

        $this->shiftSaleEndDates($event->getId(), $oldStart, $oldStart->diffInSeconds($newStart, false));

        return $this->eventDateChangeRepository->create([
            EventDateChangeDomainObjectAbstract::EVENT_ID => $event->getId(),
            EventDateChangeDomainObjectAbstract::USER_ID => $dto->userId,
            EventDateChangeDomainObjectAbstract::OLD_START_DATE => $oldStart->format(self::DATE_FORMAT),
            EventDateChangeDomainObjectAbstract::OLD_END_DATE => $oldEnd?->format(self::DATE_FORMAT),
            EventDateChangeDomainObjectAbstract::NEW_START_DATE => $newStart->format(self::DATE_FORMAT),
            EventDateChangeDomainObjectAbstract::NEW_END_DATE => $newEnd?->format(self::DATE_FORMAT),
            EventDateChangeDomainObjectAbstract::REFUNDS_ALLOWED => $dto->refundsAllowed,
            EventDateChangeDomainObjectAbstract::REFUND_DEADLINE => $refundDeadline?->format(self::DATE_FORMAT),
            EventDateChangeDomainObjectAbstract::MESSAGE => trim($dto->message),
        ]);
    }

    /**
     * 48 hours before the new start by default; when that is already past (an event moved to
     * tomorrow), until the new start.
     *
     * @throws EventChangeNotAllowedException
     */
    private function refundDeadline(PostponeEventDTO $dto, Carbon $newStart, string $timezone): Carbon
    {
        if ($dto->refundDeadline === null || $dto->refundDeadline === '') {
            $deadline = $newStart->copy()->subHours(self::DEFAULT_REFUND_DEADLINE_HOURS);

            return $deadline->isPast() ? $newStart->copy() : $deadline;
        }

        $deadline = Carbon::parse($dto->refundDeadline, $timezone)->utc();

        if ($deadline->isPast()) {
            throw new EventChangeNotAllowedException(__('The refund deadline must be in the future.'));
        }

        if ($deadline->greaterThan($newStart)) {
            throw new EventChangeNotAllowedException(__('The refund deadline must be before the new start.'));
        }

        return $deadline;
    }

    private function shiftSaleEndDates(int $eventId, Carbon $oldStart, int $seconds): void
    {
        if ($seconds === 0) {
            return;
        }

        $products = $this->productRepository->findWhere([
            ProductDomainObjectAbstract::EVENT_ID => $eventId,
        ]);

        foreach ($products as $product) {
            /** @var ProductDomainObject $product */
            $shifted = $this->shifted($product->getSaleEndDate(), $oldStart, $seconds);
            if ($shifted !== null) {
                $this->productRepository->updateWhere(
                    attributes: [ProductDomainObjectAbstract::SALE_END_DATE => $shifted],
                    where: [ProductDomainObjectAbstract::ID => $product->getId()],
                );
            }
        }

        $productIds = $products->map(fn(ProductDomainObject $product) => $product->getId())->values()->all();
        if ($productIds === []) {
            return;
        }

        foreach ($this->productPriceRepository->findWhereIn(ProductPriceDomainObjectAbstract::PRODUCT_ID, $productIds) as $price) {
            /** @var ProductPriceDomainObject $price */
            $shifted = $this->shifted($price->getSaleEndDate(), $oldStart, $seconds);
            if ($shifted !== null) {
                $this->productPriceRepository->updateWhere(
                    attributes: [ProductPriceDomainObjectAbstract::SALE_END_DATE => $shifted],
                    where: [ProductPriceDomainObjectAbstract::ID => $price->getId()],
                );
            }
        }
    }

    private function shifted(?string $saleEndDate, Carbon $oldStart, int $seconds): ?string
    {
        if ($saleEndDate === null) {
            return null;
        }

        $end = Carbon::parse($saleEndDate, 'UTC');

        return $end->greaterThanOrEqualTo($oldStart)
            ? $end->addSeconds($seconds)->format(self::DATE_FORMAT)
            : null;
    }
}
