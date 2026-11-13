<?php

namespace HiEvents\Services\Application\Handlers\Event;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\Generated\EventDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\PromoCodeDomainObjectAbstract;
use HiEvents\DomainObjects\ImageDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\OrganizerSettingDomainObject;
use HiEvents\DomainObjects\ProductCategoryDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use HiEvents\DomainObjects\PromoCodeDomainObject;
use HiEvents\DomainObjects\Status\EventStatus;
use HiEvents\DomainObjects\TaxAndFeesDomainObject;
use HiEvents\Repository\Eloquent\Value\OrderAndDirection;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\PromoCodeRepositoryInterface;
use HiEvents\Services\Application\Handlers\Event\DTO\GetPublicEventDTO;
use HiEvents\Services\Domain\Event\EventPageViewIncrementService;
use HiEvents\Services\Domain\Organizer\PlatformSupportService;
use HiEvents\Services\Domain\Product\ProductFilterService;
use Illuminate\Support\Collection;

class GetPublicEventHandler
{
    public const MAX_SERIES_OCCURRENCES = 6;

    public function __construct(
        private readonly EventRepositoryInterface      $eventRepository,
        private readonly PromoCodeRepositoryInterface  $promoCodeRepository,
        private readonly ProductFilterService          $productFilterService,
        private readonly EventPageViewIncrementService $eventPageViewIncrementService,
        private readonly PlatformSupportService        $platformSupportService,
    )
    {
    }

    public function handle(GetPublicEventDTO $data): EventDomainObject
    {
        $event = $this->eventRepository
            ->loadRelation(
                new Relationship(ProductCategoryDomainObject::class, [
                    new Relationship(ProductDomainObject::class,
                        nested: [
                            new Relationship(ProductPriceDomainObject::class),
                            new Relationship(TaxAndFeesDomainObject::class),
                        ],
                        orderAndDirections: [
                            new OrderAndDirection('order', 'asc'),
                        ]
                    ),
                ])
            )
            ->loadRelation(new Relationship(EventSettingDomainObject::class))
            ->loadRelation(new Relationship(ImageDomainObject::class))
            ->loadRelation(new Relationship(OrganizerDomainObject::class, nested: [
                new Relationship(ImageDomainObject::class),
                new Relationship(OrganizerSettingDomainObject::class),
            ], name: 'organizer'))
            ->findById($data->eventId);

        $organizerSettings = $event->getOrganizer()?->getOrganizerSettings();
        if ($organizerSettings?->getPlatformSupportEnabled() === false
            && $this->platformSupportService->isAlwaysOn($event->getAccountId())) {
            $organizerSettings->setPlatformSupportEnabled(true);
        }

        $validPromoCodes = $this->promoCodeRepository
            ->findWhere([PromoCodeDomainObjectAbstract::EVENT_ID => $data->eventId])
            ->filter(fn(PromoCodeDomainObject $promoCode) => $promoCode->isValid())
            ->values();

        $event->setPromoCodes($validPromoCodes);

        $promoCodeDomainObject = $data->promoCode
            ? $validPromoCodes->first(fn(PromoCodeDomainObject $promoCode) => $promoCode->getCode() === $data->promoCode)
            : null;

        if (!$data->isAuthenticated) {
            $this->eventPageViewIncrementService->increment($data->eventId, $data->ipAddress);
        }

        if ($event->getSeriesId() !== null) {
            $event->setSeriesOccurrences($this->getUpcomingSeriesOccurrences($event));
        }

        return $event->setProductCategories($this->productFilterService->filter(
            productsCategories: $event->getProductCategories(),
            promoCode: $promoCodeDomainObject
        ));
    }

    /**
     * « Autres dates »: the next live, not cancelled dates of the event's series, the event itself left out.
     */
    private function getUpcomingSeriesOccurrences(EventDomainObject $event): Collection
    {
        return $this->eventRepository
            ->findWhere(
                where: [
                    EventDomainObjectAbstract::SERIES_ID => $event->getSeriesId(),
                    EventDomainObjectAbstract::STATUS => EventStatus::LIVE->name,
                    [EventDomainObjectAbstract::ID, '!=', $event->getId()],
                    [EventDomainObjectAbstract::START_DATE, '>', now()],
                    [EventDomainObjectAbstract::CANCELLED_AT, 'null', null],
                ],
                columns: [
                    EventDomainObjectAbstract::ID,
                    EventDomainObjectAbstract::TITLE,
                    EventDomainObjectAbstract::START_DATE,
                    EventDomainObjectAbstract::END_DATE,
                    EventDomainObjectAbstract::TIMEZONE,
                ],
                orderAndDirections: [
                    new OrderAndDirection(EventDomainObjectAbstract::START_DATE, 'asc'),
                ],
            )
            ->take(self::MAX_SERIES_OCCURRENCES)
            ->values();
    }
}
