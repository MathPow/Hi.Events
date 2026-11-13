<?php

namespace HiEvents\Services\Domain\Attendee\Transfer\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;
use HiEvents\DomainObjects\Enums\TicketTransferRefusal;

class TicketTransferEligibilityDTO extends BaseDataObject
{
    /**
     * @param bool $enabled Whether the event lets participants transfer their ticket at all.
     * @param string|null $deadline The last moment to transfer, in UTC (Y-m-d H:i:s).
     */
    public function __construct(
        public readonly bool                   $enabled,
        public readonly ?string                $deadline,
        public readonly ?TicketTransferRefusal $refusal,
    )
    {
    }

    public function isAllowed(): bool
    {
        return $this->refusal === null;
    }
}
