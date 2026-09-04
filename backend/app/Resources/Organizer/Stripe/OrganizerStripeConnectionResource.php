<?php

declare(strict_types=1);

namespace HiEvents\Resources\Organizer\Stripe;

use HiEvents\Services\Domain\Payment\Stripe\DTOs\OrganizerStripeConnectionDTO;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin OrganizerStripeConnectionDTO
 */
class OrganizerStripeConnectionResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'stripe_account_id' => $this->resource->stripeAccountId,
            'is_connected' => $this->resource->stripeAccountId !== null,
            'is_setup_complete' => $this->resource->isSetupComplete,
            'connect_url' => $this->resource->connectUrl,
        ];
    }
}
