<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Affiliate;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\PromoCodeDomainObject;
use HiEvents\Exceptions\AffiliateNotFoundException;
use HiEvents\Repository\Interfaces\AffiliateRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Repository\Interfaces\PromoCodeRepositoryInterface;
use HiEvents\Services\Application\Handlers\Affiliate\DTO\AffiliatePartnerPageResponseDTO;

class GetAffiliatePartnerPageHandler
{
    public function __construct(
        private readonly AffiliateRepositoryInterface $affiliateRepository,
        private readonly EventRepositoryInterface     $eventRepository,
        private readonly OrderRepositoryInterface     $orderRepository,
        private readonly PromoCodeRepositoryInterface $promoCodeRepository,
    )
    {
    }

    /**
     * @throws AffiliateNotFoundException
     */
    public function handle(string $token): AffiliatePartnerPageResponseDTO
    {
        $affiliate = $this->affiliateRepository->findFirstWhere(['public_token' => $token]);

        if (!$affiliate) {
            throw new AffiliateNotFoundException(__('This partner link is invalid or has been revoked'));
        }

        /** @var EventDomainObject $event */
        $event = $this->eventRepository->findById($affiliate->getEventId());

        /** @var PromoCodeDomainObject|null $promoCode */
        $promoCode = $affiliate->getPromoCodeId()
            ? $this->promoCodeRepository->findFirstWhere([
                'id' => $affiliate->getPromoCodeId(),
                'event_id' => $affiliate->getEventId(),
            ])
            : null;

        $summary = $this->orderRepository->getAffiliateSalesSummary(
            eventId: $affiliate->getEventId(),
            affiliateId: $affiliate->getId(),
            promoCodeId: $promoCode?->getId(),
        );

        return new AffiliatePartnerPageResponseDTO(
            eventId: $affiliate->getEventId(),
            name: $affiliate->getName(),
            code: $affiliate->getCode(),
            status: $affiliate->getStatus(),
            promoCode: $promoCode?->getCode(),
            currency: $event->getCurrency(),
            ordersCount: $summary->ordersCount,
            ticketsCount: $summary->ticketsCount,
            totalGross: $summary->totalGross,
        );
    }
}
