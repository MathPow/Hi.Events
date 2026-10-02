<?php

namespace HiEvents\Resources\Event;

use HiEvents\Resources\BaseResource;
use HiEvents\Services\Application\Handlers\EventSettings\DTO\PlatformFeePreviewResponseDTO;

/**
 * @mixin PlatformFeePreviewResponseDTO
 */
class PlatformFeePreviewResource extends BaseResource
{
    public function toArray($request): array
    {
        return [
            'event_currency' => $this->eventCurrency,
            'fee_currency' => $this->feeCurrency,
            'fixed_fee_original' => $this->fixedFeeOriginal,
            'fixed_fee_converted' => $this->fixedFeeConverted,
            'percentage_fee' => $this->percentageFee,
            'sample_price' => $this->samplePrice,
            'platform_fee' => $this->platformFee,
            'total' => $this->total,
            'pass_processing_fee_to_buyer' => $this->passProcessingFeeToBuyer,
            'processing_fee_when_platform_fee_passed' => $this->processingFeeWhenPlatformFeePassed,
            'processing_fee_when_platform_fee_absorbed' => $this->processingFeeWhenPlatformFeeAbsorbed,
        ];
    }
}
