<?php

namespace HiEvents\Services\Domain\DonationReceipt;

use Barryvdh\DomPDF\Facade\Pdf;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrderItemDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\DonationReceiptRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Domain\DonationReceipt\DTO\DonationReceiptPdfResponseDTO;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

class GenerateDonationReceiptPDFService
{
    public function __construct(
        private readonly OrderRepositoryInterface           $orderRepository,
        private readonly DonationReceiptRepositoryInterface $donationReceiptRepository,
    )
    {
    }

    public function generatePdfFromOrderShortId(string $orderShortId, int $eventId): DonationReceiptPdfResponseDTO
    {
        return $this->generatePdf(['short_id' => $orderShortId, 'event_id' => $eventId]);
    }

    public function generatePdfFromOrderId(int $orderId, int $eventId): DonationReceiptPdfResponseDTO
    {
        return $this->generatePdf(['id' => $orderId, 'event_id' => $eventId]);
    }

    private function generatePdf(array $whereCriteria): DonationReceiptPdfResponseDTO
    {
        $order = $this->orderRepository
            ->loadRelation(OrderItemDomainObject::class)
            ->loadRelation(new Relationship(EventDomainObject::class, nested: [
                new Relationship(OrganizerDomainObject::class, name: 'organizer'),
            ], name: 'event'))
            ->findFirstWhere($whereCriteria);

        if (!$order) {
            throw new ResourceNotFoundException(__('Order not found'));
        }

        $receipt = $this->donationReceiptRepository->findIssuedForOrder($order->getId());

        if (!$receipt) {
            throw new ResourceNotFoundException(__('No donation receipt exists for this order'));
        }

        return new DonationReceiptPdfResponseDTO(
            pdf: Pdf::loadView('donation-receipt', [
                'receipt' => $receipt,
                'order' => $order,
                'event' => $order->getEvent(),
                'organizer' => $order->getEvent()?->getOrganizer(),
            ]),
            filename: 'recu-' . $receipt->getReceiptNumber() . '.pdf',
        );
    }
}
