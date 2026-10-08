<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Affiliate;

use HiEvents\DomainObjects\AffiliateDomainObject;
use HiEvents\Exceptions\ResourceConflictException;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Repository\Interfaces\AffiliateRepositoryInterface;
use HiEvents\Services\Application\Handlers\Affiliate\DTO\UpsertAffiliateDTO;
use HiEvents\Services\Domain\Affiliate\AffiliatePromoCodeValidationService;
use Illuminate\Support\Str;

class CreateAffiliateHandler
{
    public function __construct(
        private readonly AffiliateRepositoryInterface        $affiliateRepository,
        private readonly AffiliatePromoCodeValidationService $promoCodeValidationService,
    )
    {
    }

    /**
     * @throws ResourceConflictException
     * @throws ResourceNotFoundException
     */
    public function handle(int $eventId, int $accountId, UpsertAffiliateDTO $dto): AffiliateDomainObject
    {
        $code = strtoupper($dto->code);

        $existingAffiliate = $this->affiliateRepository->findFirstWhere([
            'event_id' => $eventId,
            'code' => $code,
        ]);

        if ($existingAffiliate) {
            throw new ResourceConflictException(__('An affiliate with this code already exists for this event'));
        }

        $this->promoCodeValidationService->assertPromoCodeBelongsToEvent($dto->promo_code_id, $eventId);

        return $this->affiliateRepository->create([
            'event_id' => $eventId,
            'account_id' => $accountId,
            'name' => $dto->name,
            'code' => $code,
            'email' => $dto->email,
            'status' => $dto->status->value,
            'promo_code_id' => $dto->promo_code_id,
            'public_token' => Str::random(48),
        ]);
    }
}
