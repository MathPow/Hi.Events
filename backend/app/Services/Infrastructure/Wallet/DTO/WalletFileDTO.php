<?php

declare(strict_types=1);

namespace HiEvents\Services\Infrastructure\Wallet\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class WalletFileDTO extends BaseDataObject
{
    public function __construct(
        public readonly string $content,
        public readonly string $mimeType,
        public readonly string $filename,
    )
    {
    }
}
