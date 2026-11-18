<?php

namespace HiEvents\Services\Domain\Event\RecurringEvent\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

/**
 * One date of a repeated event: its calendar day and its start and end as wall-clock
 * times in the event's timezone (what CreateEventService expects).
 */
class EventOccurrenceDTO extends BaseDataObject
{
    public function __construct(
        public readonly string  $date,
        public readonly string  $startDate,
        public readonly ?string $endDate,
    )
    {
    }
}
