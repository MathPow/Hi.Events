<?php

declare(strict_types=1);

namespace HiEvents\Resources\Account\Square;

use HiEvents\Services\Domain\Payment\Square\DTO\SquareConnectionDTO;
use HiEvents\Services\Domain\Payment\Square\DTO\SquareLocationDTO;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SquareConnectionDTO
 */
class SquareConnectionResource extends JsonResource
{
    public function toArray($request): array
    {
        $credential = $this->resource->credential;

        return [
            'is_oauth_configured' => $this->resource->isOAuthConfigured,
            'is_connected' => $credential !== null,
            'is_setup_complete' => $credential?->isSetupComplete() ?? false,
            'environment' => $credential?->getEnvironment(),
            'merchant_id' => $credential?->getMerchantId(),
            'merchant_name' => $this->getMerchantName(),
            'location_id' => $credential?->getLocationId(),
            'currency' => $credential?->getCurrency(),
            'country' => $credential?->getCountry(),
            'connected_at' => $credential?->getCreatedAt(),
            'locations' => array_map(
                static fn(SquareLocationDTO $location) => [
                    'id' => $location->id,
                    'name' => $location->name,
                    'currency' => $location->currency,
                    'country' => $location->country,
                    'is_active' => $location->isActive,
                ],
                $this->resource->locations,
            ),
        ];
    }

    /**
     * merchant_details vient de Square tel quel, et le cast du modele peut le
     * rendre en tableau comme en chaine JSON selon le chemin de lecture.
     */
    private function getMerchantName(): ?string
    {
        $details = $this->resource->credential?->getMerchantDetails();

        if (is_string($details)) {
            $details = json_decode($details, true);
        }

        return is_array($details) ? ($details['business_name'] ?? null) : null;
    }
}
