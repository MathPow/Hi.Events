<?php

namespace HiEvents\Services\Application\Handlers\EventSettings\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class PlatformFeePreviewResponseDTO extends BaseDataObject
{
    public function __construct(
        public readonly string  $eventCurrency,
        public readonly ?string $feeCurrency,
        public readonly float   $fixedFeeOriginal,
        public readonly float   $fixedFeeConverted,
        public readonly float   $percentageFee,
        public readonly float   $samplePrice,
        public readonly float   $platformFee,
        public readonly float   $total,
        public readonly bool    $passProcessingFeeToBuyer = false,
        public readonly float   $processingFeeWhenPlatformFeePassed = 0,
        public readonly float   $processingFeeWhenPlatformFeeAbsorbed = 0,
    ) {
    }
}
