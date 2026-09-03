<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Payment\Square\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class SquareLocationDTO extends BaseDataObject
{
    public function __construct(
        public readonly string  $id,
        public readonly string  $name,
        public readonly ?string $currency = null,
        public readonly ?string $country = null,
        public readonly bool    $isActive = true,
    )
    {
    }
}
