<?php

namespace HiEvents\Services\Domain\Attendee;

use Barryvdh\DomPDF\Facade\Pdf;
use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrderItemDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Services\Infrastructure\QrCode\QrCodeImageService;
use Illuminate\Support\Collection;

/**
 * Builds the printable ticket that gets attached to ticket emails, one page per attendee, each with
 * its own scannable QR code.
 */
class GenerateAttendeeTicketPDFService
{
    public function __construct(
        private readonly QrCodeImageService $qrCodeImageService,
    )
    {
    }

    /**
     * @param Collection<int, AttendeeDomainObject> $attendees
     */
    public function generatePdf(
        Collection               $attendees,
        OrderDomainObject        $order,
        EventDomainObject        $event,
        EventSettingDomainObject $eventSettings,
        OrganizerDomainObject    $organizer,
    ): string
    {
        $tickets = $attendees->map(fn(AttendeeDomainObject $attendee) => [
            'attendee' => $attendee,
            'productName' => $this->resolveProductName($attendee, $order),
            'qrCode' => $this->qrCodeImageService->renderSvgDataUri($attendee->getPublicId()),
        ]);

        return Pdf::loadView('attendee-tickets', [
            'tickets' => $tickets,
            'order' => $order,
            'event' => $event,
            'eventSettings' => $eventSettings,
            'organizer' => $organizer,
        ])->output();
    }

    /**
     * The order items carry the name the buyer actually saw at checkout, so prefer them. They are
     * not always loaded (the resend flows fetch the attendee on its own), hence the fallbacks.
     */
    private function resolveProductName(AttendeeDomainObject $attendee, OrderDomainObject $order): ?string
    {
        $orderItem = $order->getOrderItems()?->first(
            fn(OrderItemDomainObject $item) => $item->getProductPriceId() === $attendee->getProductPriceId()
        );

        return $orderItem?->getItemName() ?? $attendee->getProduct()?->getTitle();
    }
}
