<?php

namespace HiEvents\Jobs\EventChange;

use HiEvents\Services\Domain\EventChange\EventCancellationNotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class StartEventCancellationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct(public readonly int $eventCancellationId)
    {
    }

    public function handle(EventCancellationNotificationService $service): void
    {
        $service->start($this->eventCancellationId);
    }
}
