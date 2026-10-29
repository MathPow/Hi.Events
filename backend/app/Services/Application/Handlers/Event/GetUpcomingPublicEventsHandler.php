<?php

namespace HiEvents\Services\Application\Handlers\Event;

use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\Generated\EventDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\OrganizerDomainObjectAbstract;
use HiEvents\DomainObjects\ImageDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\ProductCategoryDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use HiEvents\DomainObjects\Status\EventStatus;
use HiEvents\DomainObjects\Status\OrganizerStatus;
use HiEvents\DomainObjects\TaxAndFeesDomainObject;
use HiEvents\Http\DTO\QueryParamsDTO;
use HiEvents\Repository\Eloquent\Value\OrderAndDirection;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * The next live events of the whole ticketing platform, from published organizers,
 * soonest first: the landing page's banner, the events to discover on « Mes billets »,
 * and, up to MAX_LIMIT of them, the events directory.
 * Their products come along, as on an organizer's page, for the cards' price and spots.
 */
class GetUpcomingPublicEventsHandler
{
    public const LIMIT = 12;

    public const MAX_LIMIT = 100;

    public function __construct(
        private readonly EventRepositoryInterface $eventRepository,
    )
    {
    }

    public function handle(int $limit = self::LIMIT): LengthAwarePaginator
    {
        return $this->eventRepository
            ->loadRelation(new Relationship(ProductCategoryDomainObject::class, [
                new Relationship(ProductDomainObject::class,
                    nested: [
                        new Relationship(ProductPriceDomainObject::class),
                        new Relationship(TaxAndFeesDomainObject::class),
                    ],
                    orderAndDirections: [
                        new OrderAndDirection('order', 'asc'),
                    ]
                ),
            ]))
            ->loadRelation(new Relationship(EventSettingDomainObject::class))
            ->loadRelation(new Relationship(ImageDomainObject::class))
            ->loadRelation(new Relationship(OrganizerDomainObject::class, name: 'organizer'))
            ->findEvents(
                where: [
                    EventDomainObjectAbstract::STATUS => EventStatus::LIVE->name,
                    static fn(Builder $builder) => $builder->whereHas(
                        'organizer',
                        static fn(Builder $organizer) => $organizer->where(OrganizerDomainObjectAbstract::STATUS, OrganizerStatus::LIVE->name),
                    ),
                ],
                params: new QueryParamsDTO(
                    page: 1,
                    per_page: max(1, min($limit, self::MAX_LIMIT)),
                    sort_by: EventDomainObjectAbstract::START_DATE,
                    sort_direction: 'asc',
                    filter_fields: collect(),
                    query_params: collect(['eventsStatus' => 'upcoming']),
                ),
            );
    }
}
