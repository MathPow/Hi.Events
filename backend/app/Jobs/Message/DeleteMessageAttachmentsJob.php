<?php

namespace HiEvents\Jobs\Message;

use HiEvents\Services\Domain\Message\MessageAttachmentService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

class DeleteMessageAttachmentsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    /**
     * @param array<int, array{disk: string, path: string, name: string}> $attachments
     */
    public function __construct(
        private readonly array $attachments,
    )
    {
    }

    public function handle(MessageAttachmentService $attachmentService): void
    {
        $attachmentService->delete($this->attachments);
    }
}
