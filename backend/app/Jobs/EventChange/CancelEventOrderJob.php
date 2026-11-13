<?php

namespace HiEvents\Jobs\EventChange;

use HiEvents\DomainObjects\Generated\EventChangeRefundDomainObjectAbstract;
use HiEvents\DomainObjects\Status\EventChangeRefundStatus;
use HiEvents\Repository\Interfaces\EventChangeRefundRepositoryInterface;
use HiEvents\Services\Domain\EventChange\EventCancellationOrderService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

/**
 * Cancels and refunds one order of a cancelled event. Never retried: a refund is only sent once,
 * and what went wrong is recorded for the organizer.
 */
class CancelEventOrderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct(public readonly int $eventChangeRefundId)
    {
    }

    public function handle(EventCancellationOrderService $service): void
    {
        $service->process($this->eventChangeRefundId);
    }

    public function failed(?Throwable $exception): void
    {
        app(EventChangeRefundRepositoryInterface::class)->updateWhere(
            attributes: [
                EventChangeRefundDomainObjectAbstract::STATUS => EventChangeRefundStatus::FAILED->name,
                EventChangeRefundDomainObjectAbstract::ERROR => $exception ? mb_substr($exception->getMessage(), 0, 1000) : null,
            ],
            where: [
                EventChangeRefundDomainObjectAbstract::ID => $this->eventChangeRefundId,
                EventChangeRefundDomainObjectAbstract::STATUS => EventChangeRefundStatus::PENDING->name,
            ],
        );
    }
}
