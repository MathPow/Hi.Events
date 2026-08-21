<?php

namespace HiEvents\Services\Application\Handlers\Order\Public;

use HiEvents\Services\Domain\DonationReceipt\DTO\DonationReceiptPdfResponseDTO;
use HiEvents\Services\Domain\DonationReceipt\GenerateDonationReceiptPDFService;

class DownloadDonationReceiptPublicHandler
{
    public function __construct(
        private readonly GenerateDonationReceiptPDFService $generateDonationReceiptPDFService,
    )
    {
    }

    public function handle(int $eventId, string $orderShortId): DonationReceiptPdfResponseDTO
    {
        return $this->generateDonationReceiptPDFService->generatePdfFromOrderShortId(
            orderShortId: $orderShortId,
            eventId: $eventId,
        );
    }
}
