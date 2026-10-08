<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Affiliate;

use HiEvents\DomainObjects\AffiliateDomainObject;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Repository\Interfaces\AffiliateRepositoryInterface;
use HiEvents\Services\Application\Handlers\Affiliate\DTO\UpsertAffiliateDTO;
use HiEvents\Services\Domain\Affiliate\AffiliatePromoCodeValidationService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class UpdateAffiliateHandler
{
    public function __construct(
        private readonly AffiliateRepositoryInterface        $affiliateRepository,
        private readonly AffiliatePromoCodeValidationService $promoCodeValidationService,
    )
    {
    }

    /**
     * @throws ResourceNotFoundException
     */
    public function handle(int $affiliateId, int $eventId, UpsertAffiliateDTO $dto): AffiliateDomainObject
    {
        $existingAffiliate = $this->affiliateRepository->findFirstWhere([
            'id' => $affiliateId,
            'event_id' => $eventId
        ]);

        if (!$existingAffiliate) {
            throw new NotFoundHttpException(__('Affiliate not found'));
        }

        $this->promoCodeValidationService->assertPromoCodeBelongsToEvent($dto->promo_code_id, $eventId);

        $updateData = array_filter([
            'name' => $dto->name,
            'email' => $dto->email,
            'status' => $dto->status->value,
        ], static fn($value) => $value !== null);

        $updateData['promo_code_id'] = $dto->promo_code_id;

        return $this->affiliateRepository->updateFromArray($affiliateId, $updateData);
    }
}
