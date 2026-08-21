<?php

namespace HiEvents\Listeners\Order;

use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Events\OrderStatusChangedEvent;
use HiEvents\Services\Domain\DonationReceipt\DonationReceiptCreateService;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Emet le recu officiel des qu'une commande est completee.
 *
 * L'emission ne doit JAMAIS faire echouer la commande: un probleme de recu est
 * un probleme administratif, pas une raison de perdre une vente deja payee.
 * D'ou le catch large, qui journalise et laisse passer. Le recu manquant se
 * rattrape ensuite a la main sur la commande.
 */
class CreateDonationReceiptListener
{
    public function __construct(
        private readonly DonationReceiptCreateService $donationReceiptCreateService,
        private readonly LoggerInterface              $logger,
    )
    {
    }

    public function handle(OrderStatusChangedEvent $event): void
    {
        $order = $event->order;

        if ($order->getStatus() !== OrderStatus::COMPLETED->name) {
            return;
        }

        try {
            $this->donationReceiptCreateService->createReceiptForOrder($order->getId());
        } catch (Throwable $exception) {
            $this->logger->error('Failed to issue donation receipt', [
                'orderId' => $order->getId(),
                'exception' => $exception,
            ]);
        }
    }
}
