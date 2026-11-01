<?php

namespace HiEvents\Services\Domain\Assistant;

use Exception;

class UnknownAssistantModelException extends Exception
{
    public function __construct(public readonly string $model)
    {
        parent::__construct(sprintf('The assistant cannot run on %s.', $model));
    }
}
