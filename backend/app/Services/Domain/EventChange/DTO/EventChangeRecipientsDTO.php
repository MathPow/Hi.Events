<?php

namespace HiEvents\Services\Domain\EventChange\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;
use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use Illuminate\Support\Collection;

class EventChangeRecipientsDTO extends BaseDataObject
{
    /**
     * @param Collection<int, OrderDomainObject> $orders each buyer, once per order
     * @param Collection<int, AttendeeDomainObject> $attendees the participants who are not a buyer, once per address
     */
    public function __construct(
        public readonly Collection $orders,
        public readonly Collection $attendees,
    )
    {
    }

    public function count(): int
    {
        return $this->orders->count() + $this->attendees->count();
    }
}
