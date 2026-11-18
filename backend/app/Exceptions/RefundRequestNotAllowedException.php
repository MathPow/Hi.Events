<?php

namespace HiEvents\Exceptions;

use Exception;
use HiEvents\Services\Domain\EventChange\Enums\RefundRequestRefusal;

class RefundRequestNotAllowedException extends Exception
{
    public function __construct(public readonly RefundRequestRefusal $refusal)
    {
        parent::__construct($refusal->message());
    }
}
