<?php

namespace HiEvents\Jobs\LiveTrack;

use HiEvents\DomainObjects\LiveTrackDomainObject;
use HiEvents\Repository\Interfaces\LiveTrackRepositoryInterface;
use HiEvents\Services\Domain\LiveTrack\LiveTrackService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/** Positions are only for race day: a shared track and its trail go KEPT_FOR_DAYS after. */
class PurgeOldLiveTracksJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(LiveTrackRepositoryInterface $liveTrackRepository): void
    {
        $liveTrackRepository->deleteWhere([
            [LiveTrackDomainObject::CONSENTED_AT, '<', now()->subDays(LiveTrackService::KEPT_FOR_DAYS)],
        ]);
    }
}
