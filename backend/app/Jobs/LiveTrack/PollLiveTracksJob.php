<?php

namespace HiEvents\Jobs\LiveTrack;

use HiEvents\DomainObjects\LiveTrackDomainObject;
use HiEvents\DomainObjects\Status\LiveTrackStatus;
use HiEvents\Repository\Eloquent\Value\OrderAndDirection;
use HiEvents\Repository\Interfaces\LiveTrackRepositoryInterface;
use HiEvents\Services\Domain\LiveTrack\LiveTrackService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Every minute, the new positions of the participants who shared their LiveTrack: the least
 * recently read first, until the time runs out (the rest go first on the next minute).
 */
class PollLiveTracksJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    private const TIME_BUDGET_SECONDS = 45;

    public int $timeout = 55;

    public function handle(LiveTrackRepositoryInterface $liveTrackRepository, LiveTrackService $liveTrackService): void
    {
        $startedAt = microtime(true);

        $liveTracks = $liveTrackRepository->findWhere(
            where: [
                [LiveTrackDomainObject::STATUS, 'in', LiveTrackStatus::polled()],
                [LiveTrackDomainObject::CONSENTED_AT, '>', now()->subHours(LiveTrackService::POLLED_FOR_HOURS)],
            ],
            orderAndDirections: [new OrderAndDirection(LiveTrackDomainObject::LAST_POLLED_AT, 'asc')],
        );

        foreach ($liveTracks as $liveTrack) {
            if (microtime(true) - $startedAt > self::TIME_BUDGET_SECONDS) {
                return;
            }
            $liveTrackService->poll($liveTrack);
        }
    }
}
