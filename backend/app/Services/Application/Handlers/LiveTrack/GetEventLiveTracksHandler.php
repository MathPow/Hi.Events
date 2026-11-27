<?php

namespace HiEvents\Services\Application\Handlers\LiveTrack;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\LiveTrackDomainObject;
use HiEvents\DomainObjects\LiveTrackPointDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\Repository\Eloquent\Value\OrderAndDirection;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\LiveTrackPointRepositoryInterface;
use HiEvents\Repository\Interfaces\LiveTrackRepositoryInterface;
use Illuminate\Support\Collection;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

/**
 * The organizer's « Suivi en direct »: every shared track of the event with its participant, and
 * one participant's trail.
 */
class GetEventLiveTracksHandler
{
    public function __construct(
        private readonly LiveTrackRepositoryInterface      $liveTrackRepository,
        private readonly LiveTrackPointRepositoryInterface $pointRepository,
    )
    {
    }

    /**
     * @return Collection<int, LiveTrackDomainObject>
     */
    public function forEvent(int $eventId): Collection
    {
        return $this->liveTrackRepository
            ->loadRelation(new Relationship(
                domainObject: AttendeeDomainObject::class,
                nested: [new Relationship(domainObject: ProductDomainObject::class, name: 'product')],
                name: 'attendee',
            ))
            ->findWhere(
                where: [LiveTrackDomainObject::EVENT_ID => $eventId],
                orderAndDirections: [new OrderAndDirection(LiveTrackDomainObject::ID, 'asc')],
            );
    }

    /**
     * @return Collection<int, LiveTrackPointDomainObject>
     */
    public function trail(int $eventId, int $liveTrackId): Collection
    {
        $liveTrack = $this->liveTrackRepository->findFirstWhere([
            LiveTrackDomainObject::ID => $liveTrackId,
            LiveTrackDomainObject::EVENT_ID => $eventId,
        ]);

        if ($liveTrack === null) {
            throw new ResourceNotFoundException(__('Live track not found'));
        }

        return $this->pointRepository->findWhere(
            where: [LiveTrackPointDomainObject::LIVE_TRACK_ID => $liveTrackId],
            orderAndDirections: [new OrderAndDirection(LiveTrackPointDomainObject::RECORDED_AT, 'asc')],
        );
    }
}
