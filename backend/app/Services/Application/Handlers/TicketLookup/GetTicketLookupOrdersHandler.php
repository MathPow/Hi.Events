<?php

namespace HiEvents\Services\Application\Handlers\TicketLookup;

use HiEvents\DomainObjects\AttendeeCheckInDomainObject;
use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\Generated\EventDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\OrderDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\OrganizerDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\ProductDomainObjectAbstract;
use HiEvents\DomainObjects\ImageDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Repository\Eloquent\Value\OrderAndDirection;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Domain\Order\OfflinePaymentInstructionsRenderService;
use Illuminate\Support\Collection;

class GetTicketLookupOrdersHandler
{
    public function __construct(
        private readonly OrderRepositoryInterface $orderRepository,
        private readonly OfflinePaymentInstructionsRenderService $offlinePaymentInstructionsRenderService,
    ) {
    }

    /**
     * @return Collection<OrderDomainObject>
     */
    public function handle(string $email): Collection
    {
        return $this->getOrdersForEmail($email)
            ->each(fn(OrderDomainObject $order) => $this->offlinePaymentInstructionsRenderService->renderForOrder($order));
    }

    /**
     * @return Collection<OrderDomainObject>
     */
    private function getOrdersForEmail(string $email): Collection
    {
        return $this->orderRepository
            ->loadRelation(new Relationship(
                domainObject: AttendeeDomainObject::class,
                nested: [
                    new Relationship(
                        domainObject: ProductDomainObject::class,
                        nested: [
                            new Relationship(
                                domainObject: ProductPriceDomainObject::class,
                            )
                        ],
                        name: ProductDomainObjectAbstract::SINGULAR_NAME,
                    ),
                    // Pour « Scanne le ... » des billets utilises de Mes billets.
                    new Relationship(
                        domainObject: AttendeeCheckInDomainObject::class,
                        name: 'check_ins',
                    ),
                ],
            ))
            ->loadRelation(new Relationship(
                domainObject: EventDomainObject::class,
                nested: [
                    new Relationship(
                        domainObject: EventSettingDomainObject::class,
                    ),
                    new Relationship(
                        domainObject: OrganizerDomainObject::class,
                        name: OrganizerDomainObjectAbstract::SINGULAR_NAME,
                    ),
                    new Relationship(
                        domainObject: ImageDomainObject::class,
                    )
                ],
                name: EventDomainObjectAbstract::SINGULAR_NAME
            ))
            ->findWhere(
                [
                    [OrderDomainObjectAbstract::EMAIL, '=', $email],
                    [OrderDomainObjectAbstract::STATUS, '=', OrderStatus::COMPLETED->name],
                ],
                orderAndDirections: [
                    new OrderAndDirection(OrderDomainObjectAbstract::CREATED_AT, 'desc'),
                ],
            );
    }
}
