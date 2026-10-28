<?php

namespace HiEvents\Services\Application\Handlers\Event;

use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\Generated\EventDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\OrganizerDomainObjectAbstract;
use HiEvents\DomainObjects\ImageDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\Status\EventStatus;
use HiEvents\DomainObjects\Status\OrganizerStatus;
use HiEvents\Http\DTO\QueryParamsDTO;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * The next live events of the whole ticketing platform, from published organizers,
 * soonest first: the landing page's banner.
 */
class GetUpcomingPublicEventsHandler
{
    public const LIMIT = 12;

    public function __construct(
        private readonly EventRepositoryInterface $eventRepository,
    )
    {
    }

    public function handle(): LengthAwarePaginator
    {
        return $this->eventRepository
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
                    per_page: self::LIMIT,
                    sort_by: EventDomainObjectAbstract::START_DATE,
                    sort_direction: 'asc',
                    filter_fields: collect(),
                    query_params: collect(['eventsStatus' => 'upcoming']),
                ),
            );
    }
}
