<?php

namespace HiEvents\Services\Application\Handlers\Organizer\Order;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\InvoiceDomainObject;
use HiEvents\DomainObjects\OrderItemDomainObject;
use HiEvents\Http\DTO\QueryParamsDTO;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class GetOrganizerOrdersHandler
{
    public function __construct(
        private readonly OrderRepositoryInterface $orderRepository,
    )
    {
    }

    public function handle(int $organizer, int $accountId, QueryParamsDTO $queryParams): LengthAwarePaginator
    {
        return $this->orderRepository
            ->loadRelation(OrderItemDomainObject::class)
            ->loadRelation(AttendeeDomainObject::class)
            ->loadRelation(InvoiceDomainObject::class)
            ->loadRelation(new Relationship(domainObject: EventDomainObject::class, name: 'event'))
            ->findByOrganizerId(
                organizerId: $organizer,
                accountId: $accountId,
                params: $queryParams,
            );
    }
}
