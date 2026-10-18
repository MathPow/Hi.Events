<?php

declare(strict_types=1);

namespace HiEvents\Exceptions;

use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

class EmailSendingLimitExceededException extends TooManyRequestsHttpException
{
    public function __construct(string $message)
    {
        parent::__construct(message: $message);
    }
}
