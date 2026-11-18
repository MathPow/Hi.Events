<?php

declare(strict_types=1);

namespace HiEvents\Exceptions;

use HiEvents\DomainObjects\Enums\TicketTransferRefusal;

class TicketTransferNotAllowedException extends BaseException
{
    public function __construct(public readonly TicketTransferRefusal $refusal)
    {
        parent::__construct($refusal->message());
    }
}
