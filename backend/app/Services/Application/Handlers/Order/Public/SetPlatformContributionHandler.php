<?php

namespace HiEvents\Services\Application\Handlers\Order\Public;

use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrderItemDomainObject;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Exceptions\ResourceConflictException;
use HiEvents\Helper\Currency;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Domain\Order\OrderManagementService;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

class SetPlatformContributionHandler
{
    public function __construct(
        private readonly OrderRepositoryInterface $orderRepository,
        private readonly OrderManagementService   $orderManagementService,
    )
    {
    }

    public function handle(int $eventId, string $orderShortId, float $contribution): OrderDomainObject
    {
        $order = $this->orderRepository
            ->loadRelation(OrderItemDomainObject::class)
            ->findFirstWhere(['short_id' => $orderShortId, 'event_id' => $eventId]);

        if (!$order) {
            throw new ResourceNotFoundException(__('Order not found'));
        }

        // Une commande payee ne se renchérit pas apres coup: sans ce garde, un
        // appel tardif gonflerait le total d'une commande deja encaissee et la
        // facture ne correspondrait plus au montant debite.
        if ($order->getStatus() !== OrderStatus::RESERVED->name) {
            throw new ResourceConflictException(__('This order can no longer be modified.'));
        }

        $this->orderRepository->updateFromArray($order->getId(), [
            'platform_contribution' => Currency::round(max(0, $contribution)),
        ]);

        $refreshed = $this->orderRepository
            ->loadRelation(OrderItemDomainObject::class)
            ->findById($order->getId());

        return $this->orderManagementService->updateOrderTotals($refreshed, $refreshed->getOrderItems());
    }
}
