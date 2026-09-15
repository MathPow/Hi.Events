<?php

namespace HiEvents\Jobs\Order;

use HiEvents\Services\Domain\Order\AbandonedOrderAnonymizationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class AnonymizeAbandonedOrdersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * @throws Throwable
     */
    public function handle(AbandonedOrderAnonymizationService $anonymizationService): void
    {
        $count = $anonymizationService->anonymizeExpiredAbandonedOrders();

        if ($count > 0) {
            Log::info('Anonymized personal data of abandoned orders', ['count' => $count]);
        }
    }
}
