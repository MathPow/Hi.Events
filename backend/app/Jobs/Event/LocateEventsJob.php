<?php

namespace HiEvents\Jobs\Event;

use HiEvents\Repository\Interfaces\EventSettingsRepositoryInterface;
use HiEvents\Services\Domain\Event\EventLocationCoordinatesService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Finds the place (and its region) of events nobody has opened since it was last looked up, a few
 * at a time: the geocoder allows one request per second. Events opened by visitors are found then.
 */
class LocateEventsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public const BATCH_SIZE = 5;

    public function handle(
        EventSettingsRepositoryInterface $eventSettingsRepository,
        EventLocationCoordinatesService  $coordinatesService,
    ): void
    {
        $settings = $eventSettingsRepository->findNotLocatedWith(
            EventLocationCoordinatesService::FINGERPRINT_VERSION,
            self::BATCH_SIZE,
        );

        foreach ($settings as $setting) {
            $coordinatesService->getCoordinates($setting);
        }
    }
}
