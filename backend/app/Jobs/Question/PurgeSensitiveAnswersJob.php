<?php

namespace HiEvents\Jobs\Question;

use HiEvents\Services\Domain\Question\SensitiveAnswerPurgeService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class PurgeSensitiveAnswersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(SensitiveAnswerPurgeService $purgeService): void
    {
        $count = $purgeService->purgeExpiredAnswers();

        if ($count > 0) {
            Log::info('Erased answers to sensitive questions of past events', ['count' => $count]);
        }
    }
}
