<?php

namespace HiEvents\Services\Application\Handlers\CheckInList\Public;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\Enums\AttendeeCheckInActionType;
use HiEvents\Exceptions\CannotCheckInException;
use HiEvents\Exceptions\DoorSalesNotEnabledException;
use HiEvents\Exceptions\InvalidProductPriceId;
use HiEvents\Exceptions\NoTicketsAvailableException;
use HiEvents\Exceptions\ProductNotOnCheckInListException;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Services\Application\Handlers\Attendee\CreateAttendeeHandler;
use HiEvents\Services\Application\Handlers\Attendee\DTO\CreateAttendeeDTO;
use HiEvents\Services\Application\Handlers\CheckInList\Public\DTO\AttendeeAndActionDTO;
use HiEvents\Services\Application\Handlers\CheckInList\Public\DTO\CreateDoorSaleDTO;
use HiEvents\Services\Domain\CheckInList\CreateAttendeeCheckInService;
use HiEvents\Services\Domain\DoorSale\DoorSaleListService;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Throwable;

/**
 * Sells a ticket at the door: the volunteer takes the money on the organiser's own terminal (Square,
 * cash, whatever they already use), and this records the ticket and, by default, walks the buyer
 * straight in.
 */
class CreateDoorSaleHandler
{
    public function __construct(
        private readonly DoorSaleListService          $doorSaleListService,
        private readonly CreateAttendeeHandler        $createAttendeeHandler,
        private readonly CreateAttendeeCheckInService $createAttendeeCheckInService,
    )
    {
    }

    /**
     * @return Collection<int, AttendeeDomainObject>
     * @throws DoorSalesNotEnabledException
     * @throws ResourceNotFoundException
     * @throws ProductNotOnCheckInListException
     * @throws InvalidProductPriceId
     * @throws NoTicketsAvailableException
     * @throws CannotCheckInException
     * @throws Throwable
     */
    public function handle(CreateDoorSaleDTO $doorSale): Collection
    {
        $checkInList = $this->doorSaleListService->getSellableCheckInList($doorSale->checkInListShortId);
        $product = $this->doorSaleListService->verifyProductIsOnCheckInList($checkInList, $doorSale->productId);
        $price = $this->doorSaleListService->resolveProductPrice($product, $doorSale->productPriceId);

        $remaining = $this->doorSaleListService->getQuantityRemaining($checkInList->getEventId(), $price->getId());

        if ($remaining < $doorSale->quantity) {
            throw new NoTicketsAvailableException(
                trans_choice(
                    '{0} That ticket is sold out.|{1} Only one of those tickets is left.|[2,*] Only :count of those tickets are left.',
                    $remaining,
                    ['count' => $remaining],
                )
            );
        }

        $taxesAndFees = $this->doorSaleListService->resolveTaxesAndFees($product, $price->getPrice());

        $attendees = collect();

        // Each ticket becomes its own order, matching how the dashboard issues tickets by hand.
        for ($issued = 0; $issued < $doorSale->quantity; ++$issued) {
            try {
                $attendees->push($this->createAttendeeHandler->handle(new CreateAttendeeDTO(
                    first_name: $doorSale->firstName,
                    last_name: $doorSale->lastName,
                    email: $doorSale->email ?? $this->placeholderEmail(),
                    product_id: $product->getId(),
                    event_id: $checkInList->getEventId(),
                    send_confirmation_email: $doorSale->email !== null,
                    amount_paid: $price->getPrice(),
                    locale: $doorSale->locale,
                    product_price_id: $price->getId(),
                    taxes_and_fees: $taxesAndFees,
                )));
            } catch (NoTicketsAvailableException $exception) {
                // Another door took the last ticket between our check and this write. Tickets
                // already issued are real and paid for, so hand them back rather than discarding
                // them - emails for them have gone out and cannot be unsent.
                if ($attendees->isEmpty()) {
                    throw $exception;
                }

                break;
            }
        }

        if ($doorSale->checkInImmediately) {
            $this->checkIn($doorSale, $attendees);
        }

        return $attendees;
    }

    /**
     * @param Collection<int, AttendeeDomainObject> $attendees
     * @throws CannotCheckInException
     * @throws Throwable
     */
    private function checkIn(CreateDoorSaleDTO $doorSale, Collection $attendees): void
    {
        $this->createAttendeeCheckInService->checkInAttendees(
            checkInListUuid: $doorSale->checkInListShortId,
            checkInUserIpAddress: $doorSale->checkInUserIpAddress,
            attendeesAndActions: $attendees->map(fn(AttendeeDomainObject $attendee) => new AttendeeAndActionDTO(
                public_id: $attendee->getPublicId(),
                action: AttendeeCheckInActionType::CHECK_IN,
            )),
        );
    }

    /**
     * Nobody wants to type an email address with a queue behind them. When one is not given the
     * ticket is simply not emailed, and the address stays unroutable so nothing is ever sent to it.
     */
    private function placeholderEmail(): string
    {
        return sprintf('door-sale-%s@invalid', Str::lower(Str::random(12)));
    }
}
