<?php

namespace HiEvents\Services\Domain\Attendee;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\Generated\AttendeeDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\ProductPriceDomainObjectAbstract;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use HiEvents\DomainObjects\Status\AttendeeStatus;
use HiEvents\Repository\Interfaces\AttendeeRepositoryInterface;
use HiEvents\Repository\Interfaces\ProductPriceRepositoryInterface;
use Illuminate\Database\DatabaseManager;
use Throwable;

/**
 * The bib numbers of a race: each ticket option (a distance) can have a first
 * number, and every active attendee of that option gets the next one, never
 * one already given in the event. A cancelled attendee keeps theirs: a number
 * is never handed out twice.
 */
class BibNumberService
{
    public function __construct(
        private readonly AttendeeRepositoryInterface     $attendeeRepository,
        private readonly ProductPriceRepositoryInterface $productPriceRepository,
        private readonly DatabaseManager                 $databaseManager,
    )
    {
    }

    /**
     * @throws Throwable
     */
    public function assignForOrder(OrderDomainObject $order): int
    {
        return $this->assign($order->getEventId(), [AttendeeDomainObjectAbstract::ORDER_ID => $order->getId()]);
    }

    /**
     * For attendees who registered before the first numbers were set.
     *
     * @throws Throwable
     */
    public function assignMissing(int $eventId): int
    {
        return $this->assign($eventId, []);
    }

    /**
     * @return int How many attendees got a number.
     * @throws Throwable
     */
    private function assign(int $eventId, array $where): int
    {
        return $this->databaseManager->transaction(function () use ($eventId, $where) {
            // One assignment at a time per event: two orders never draw the same number.
            $this->databaseManager->statement('SELECT pg_advisory_xact_lock(hashtext(?))', ['bib-numbers-' . $eventId]);

            $waiting = $this->attendeeRepository->findWhere([
                AttendeeDomainObjectAbstract::EVENT_ID => $eventId,
                AttendeeDomainObjectAbstract::STATUS => AttendeeStatus::ACTIVE->name,
                [AttendeeDomainObjectAbstract::BIB_NUMBER, 'null', null],
                ...$where,
            ]);

            if ($waiting->isEmpty()) {
                return 0;
            }

            $starts = $this->productPriceRepository
                ->findWhereIn(
                    ProductPriceDomainObjectAbstract::ID,
                    $waiting->map(fn(AttendeeDomainObject $attendee) => $attendee->getProductPriceId())->unique()->values()->all(),
                )
                ->filter(fn(ProductPriceDomainObject $price) => $price->getBibNumberStart() !== null)
                ->mapWithKeys(fn(ProductPriceDomainObject $price) => [$price->getId() => $price->getBibNumberStart()]);

            if ($starts->isEmpty()) {
                return 0;
            }

            $numbered = $this->attendeeRepository->findWhere(
                where: [
                    AttendeeDomainObjectAbstract::EVENT_ID => $eventId,
                    [AttendeeDomainObjectAbstract::BIB_NUMBER, 'not null', null],
                ],
                columns: [AttendeeDomainObjectAbstract::ID, AttendeeDomainObjectAbstract::PRODUCT_PRICE_ID, AttendeeDomainObjectAbstract::BIB_NUMBER],
            );

            $used = $numbered->mapWithKeys(fn(AttendeeDomainObject $attendee) => [$attendee->getBibNumber() => true])->all();
            $lastByPrice = $numbered
                ->groupBy(fn(AttendeeDomainObject $attendee) => $attendee->getProductPriceId())
                ->map(fn($attendees) => $attendees->max(fn(AttendeeDomainObject $attendee) => $attendee->getBibNumber()))
                ->all();

            $assigned = 0;

            foreach ($waiting->sortBy(fn(AttendeeDomainObject $attendee) => $attendee->getId()) as $attendee) {
                $priceId = $attendee->getProductPriceId();
                $start = $starts->get($priceId);

                if ($start === null) {
                    continue;
                }

                $number = max($start, ($lastByPrice[$priceId] ?? 0) + 1);
                while (isset($used[$number])) {
                    $number++;
                }

                $this->attendeeRepository->updateWhere(
                    attributes: [AttendeeDomainObjectAbstract::BIB_NUMBER => $number],
                    where: [AttendeeDomainObjectAbstract::ID => $attendee->getId()],
                );

                $used[$number] = true;
                $lastByPrice[$priceId] = $number;
                $assigned++;
            }

            return $assigned;
        });
    }
}
