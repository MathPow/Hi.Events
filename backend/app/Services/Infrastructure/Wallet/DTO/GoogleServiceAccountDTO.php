<?php

declare(strict_types=1);

namespace HiEvents\Services\Infrastructure\Wallet\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class GoogleServiceAccountDTO extends BaseDataObject
{
    public function __construct(
        public readonly string $clientEmail,
        public readonly string $privateKey,
    )
    {
    }
}
