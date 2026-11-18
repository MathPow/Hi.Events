<?php

namespace HiEvents\Jobs\EventChange;

use HiEvents\Services\Domain\EventChange\EventPostponementNotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendEventPostponedEmailsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    // Each email is its own queued job: running this again would send everything twice.
    public int $tries = 1;

    public function __construct(public readonly int $eventDateChangeId)
    {
    }

    public function handle(EventPostponementNotificationService $service): void
    {
        $service->notify($this->eventDateChangeId);
    }
}
