<?php

namespace HiEvents\Services\Application\Handlers\Event\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;
use HiEvents\DomainObjects\EventDomainObject;
use Illuminate\Support\Collection;

class RepeatEventResultDTO extends BaseDataObject
{
    /**
     * @param Collection<int, EventDomainObject> $createdEvents
     * @param string|null $failedDate The first date that could not be created; the next ones were not tried
     */
    public function __construct(
        public readonly Collection $createdEvents,
        public readonly ?string    $failedDate = null,
    )
    {
    }
}
