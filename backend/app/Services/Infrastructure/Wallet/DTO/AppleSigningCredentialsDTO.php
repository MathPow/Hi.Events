<?php

declare(strict_types=1);

namespace HiEvents\Services\Infrastructure\Wallet\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class AppleSigningCredentialsDTO extends BaseDataObject
{
    public function __construct(
        public readonly string $certificate,
        public readonly string $privateKey,
    )
    {
    }
}
