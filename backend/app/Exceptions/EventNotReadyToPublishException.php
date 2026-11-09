<?php

namespace HiEvents\Exceptions;

use Exception;

class EventNotReadyToPublishException extends Exception
{
    public const NO_PRODUCTS = 'no_products';

    public const PAYMENTS_NOT_READY = 'payments_not_ready';

    public function __construct(string $message, public readonly string $reason)
    {
        parent::__construct($message);
    }
}
