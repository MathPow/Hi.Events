<?php

namespace HiEvents\Http\Actions\Orders\Public;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Order\Public\DownloadDonationReceiptPublicHandler;
use Illuminate\Http\Response;

class DownloadDonationReceiptPublicAction extends BaseAction
{
    public function __construct(
        private readonly DownloadDonationReceiptPublicHandler $downloadDonationReceiptPublicHandler,
    )
    {
    }

    public function __invoke(int $eventId, string $orderShortId): Response
    {
        $receipt = $this->downloadDonationReceiptPublicHandler->handle(
            eventId: $eventId,
            orderShortId: $orderShortId,
        );

        return $receipt->pdf->stream($receipt->filename);
    }
}
