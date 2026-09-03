<?php

namespace HiEvents\Services\Application\Handlers\CheckInList\Public;

use HiEvents\Exceptions\DoorSalesNotEnabledException;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Services\Domain\DoorSale\DoorSaleListService;
use Illuminate\Support\Collection;

class GetDoorSaleProductsPublicHandler
{
    public function __construct(
        private readonly DoorSaleListService $doorSaleListService,
    )
    {
    }

    /**
     * @throws DoorSalesNotEnabledException
     * @throws ResourceNotFoundException
     */
    public function handle(string $checkInListShortId): Collection
    {
        return $this->doorSaleListService->getSellableProducts(
            $this->doorSaleListService->getSellableCheckInList($checkInListShortId)
        );
    }
}
