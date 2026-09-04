<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Order\Payment\Square\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class CreateSquarePaymentDTO extends BaseDataObject
{
    public function __construct(
        public readonly string  $orderShortId,
        public readonly string  $sourceId,
        public readonly ?string $verificationToken = null,
    )
    {
    }
}
