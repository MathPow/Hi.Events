<?php

namespace HiEvents\Services\Application\Handlers\Event\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class RepeatEventDTO extends BaseDataObject
{
    /**
     * @param string[] $dates Calendar days (Y-m-d) in the event's timezone
     */
    public function __construct(
        public readonly int   $eventId,
        public readonly int   $accountId,
        public readonly array $dates,
    )
    {
    }
}
