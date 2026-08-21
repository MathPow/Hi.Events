<?php

namespace HiEvents\Http\Actions\Orders;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Domain\DonationReceipt\GenerateDonationReceiptPDFService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class DownloadDonationReceiptAction extends BaseAction
{
    public function __construct(
        private readonly GenerateDonationReceiptPDFService $generateDonationReceiptPDFService,
    )
    {
    }

    public function __invoke(Request $request, int $eventId, int $orderId): Response
    {
        $this->isActionAuthorized($eventId, EventDomainObject::class);

        $receipt = $this->generateDonationReceiptPDFService->generatePdfFromOrderId(
            orderId: $orderId,
            eventId: $eventId,
        );

        return $receipt->pdf->stream($receipt->filename);
    }
}
