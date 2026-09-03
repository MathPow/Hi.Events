<?php

namespace HiEvents\Services\Application\Handlers\CheckInList\Public\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class CreateDoorSaleDTO extends BaseDataObject
{
    public function __construct(
        public string  $checkInListShortId,
        public int     $productId,
        public int     $quantity,
        public string  $firstName,
        public string  $lastName,
        public string  $locale,
        public string  $checkInUserIpAddress,
        public ?int    $productPriceId = null,
        public ?string $email = null,
        public bool    $checkInImmediately = true,
    )
    {
    }
}
