<?php

namespace HiEvents\Services\Domain\LiveTrack;

use Carbon\CarbonImmutable;
use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\LiveTrackDomainObject;
use HiEvents\DomainObjects\LiveTrackPointDomainObject;
use HiEvents\DomainObjects\Status\LiveTrackStatus;
use HiEvents\Exceptions\InvalidLiveTrackLinkException;
use HiEvents\Exceptions\LiveTrackSessionNotFoundException;
use HiEvents\Exceptions\LiveTrackUnavailableException;
use HiEvents\Repository\Interfaces\LiveTrackPointRepositoryInterface;
use HiEvents\Repository\Interfaces\LiveTrackRepositoryInterface;
use HiEvents\Services\Domain\LiveTrack\DTO\LiveTrackLinkDTO;
use HiEvents\Services\Domain\LiveTrack\DTO\LiveTrackPointDTO;
use HiEvents\Services\Infrastructure\LiveTrack\GarminLiveTrackClient;
use Psr\Log\LoggerInterface;

/**
 * « Suivi en direct »: the participant's shared LiveTrack session, read every minute. Each new
 * position updates the participant's last known one; the trail keeps a point every few seconds.
 */
class LiveTrackService
{
    // A point every 10 s is plenty for a trail on the organizer's map.
    public const MIN_SECONDS_BETWEEN_POINTS = 10;

    // Slower than this between two points, the participant is standing still.
    private const STILL_SPEED_MPS = 0.4;

    // A session silent this long has ended, even without Garmin saying so.
    public const SILENT_SESSION_ENDS_AFTER_HOURS = 3;

    // Polled this long after it was shared at most: a LiveTrack link doesn't outlive its activity.
    public const POLLED_FOR_HOURS = 48;

    public const KEPT_FOR_DAYS = 14;

    private const MAX_PAGES_PER_POLL = 5;

    // As many points in an answer, and there may be more.
    private const FULL_PAGE = 100;

    public function __construct(
        private readonly LiveTrackRepositoryInterface      $liveTrackRepository,
        private readonly LiveTrackPointRepositoryInterface $pointRepository,
        private readonly LiveTrackLinkParser               $linkParser,
        private readonly LiveTrackPointParser              $pointParser,
        private readonly GarminLiveTrackClient             $client,
        private readonly LoggerInterface                   $logger,
    )
    {
    }

    public function forAttendee(AttendeeDomainObject $attendee): ?LiveTrackDomainObject
    {
        return $this->liveTrackRepository->findFirstWhere([
            LiveTrackDomainObject::ATTENDEE_ID => $attendee->getId(),
        ]);
    }

    /**
     * A new link replaces the previous one, and the previous activity's trail goes with it.
     *
     * @throws InvalidLiveTrackLinkException
     */
    public function share(AttendeeDomainObject $attendee, string $pastedLink): LiveTrackDomainObject
    {
        $link = $this->linkParser->parse($pastedLink);

        try {
            $this->client->session($link);
        } catch (LiveTrackSessionNotFoundException) {
            throw new InvalidLiveTrackLinkException(__('Garmin does not know this LiveTrack link. Copy it again from the Garmin Connect app or from the email Garmin sent.'));
        } catch (LiveTrackUnavailableException $exception) {
            // Garmin is out of reach: the link is kept, the polls will tell.
            $this->logger->warning('Could not check a LiveTrack link with Garmin', ['exception' => $exception->getMessage()]);
        }

        $existing = $this->forAttendee($attendee);
        $attributes = [
            LiveTrackDomainObject::SHARE_URL => $link->url(),
            LiveTrackDomainObject::SESSION_ID => $link->sessionId,
            LiveTrackDomainObject::SESSION_TOKEN => $link->token,
            LiveTrackDomainObject::CONSENTED_AT => now(),
        ];

        if ($existing !== null && $existing->getSessionId() === $link->sessionId) {
            $liveTrack = $this->liveTrackRepository->updateFromArray($existing->getId(), [
                ...$attributes,
                LiveTrackDomainObject::STATUS => $existing->getStatus() === LiveTrackStatus::FAILED->name
                    ? LiveTrackStatus::WAITING->name
                    : $existing->getStatus(),
                LiveTrackDomainObject::LAST_ERROR => null,
            ]);
        } else {
            if ($existing !== null) {
                $this->liveTrackRepository->deleteById($existing->getId());
            }
            $liveTrack = $this->liveTrackRepository->create([
                ...$attributes,
                LiveTrackDomainObject::EVENT_ID => $attendee->getEventId(),
                LiveTrackDomainObject::ATTENDEE_ID => $attendee->getId(),
                LiveTrackDomainObject::STATUS => LiveTrackStatus::WAITING->name,
            ]);
        }

        return $this->poll($liveTrack);
    }

    public function remove(AttendeeDomainObject $attendee): void
    {
        $this->liveTrackRepository->deleteWhere([LiveTrackDomainObject::ATTENDEE_ID => $attendee->getId()]);
    }

    /**
     * Reads the points since the last one, and never throws: a failed read is kept on the track.
     */
    public function poll(LiveTrackDomainObject $liveTrack): LiveTrackDomainObject
    {
        $now = CarbonImmutable::now();
        $link = new LiveTrackLinkDTO(sessionId: $liveTrack->getSessionId(), token: $liveTrack->getSessionToken());
        $lastPointAt = $liveTrack->getLastPointAt() ? CarbonImmutable::parse($liveTrack->getLastPointAt()) : null;

        try {
            $points = $this->readPoints($link, $lastPointAt);
        } catch (LiveTrackSessionNotFoundException $exception) {
            return $this->liveTrackRepository->updateFromArray($liveTrack->getId(), [
                LiveTrackDomainObject::STATUS => $lastPointAt === null ? LiveTrackStatus::FAILED->name : LiveTrackStatus::ENDED->name,
                LiveTrackDomainObject::LAST_ERROR => $exception->getMessage(),
                LiveTrackDomainObject::LAST_POLLED_AT => $now,
            ]);
        } catch (LiveTrackUnavailableException $exception) {
            return $this->liveTrackRepository->updateFromArray($liveTrack->getId(), [
                LiveTrackDomainObject::LAST_ERROR => mb_substr($exception->getMessage(), 0, 255),
                LiveTrackDomainObject::LAST_POLLED_AT => $now,
            ]);
        }

        if ($lastPointAt !== null) {
            $points = array_values(array_filter($points, static fn(LiveTrackPointDTO $point) => $point->recordedAt > $lastPointAt));
        }

        if ($points === []) {
            $silentTooLong = $lastPointAt !== null && $lastPointAt->diffInHours($now) >= self::SILENT_SESSION_ENDS_AFTER_HOURS;

            return $this->liveTrackRepository->updateFromArray($liveTrack->getId(), [
                LiveTrackDomainObject::STATUS => $silentTooLong ? LiveTrackStatus::ENDED->name : $liveTrack->getStatus(),
                LiveTrackDomainObject::LAST_ERROR => null,
                LiveTrackDomainObject::LAST_POLLED_AT => $now,
            ]);
        }

        $kept = $this->thin($points, $lastPointAt);
        $this->pointRepository->insertIgnoringDuplicates(array_map(
            static fn(LiveTrackPointDTO $point) => [
                LiveTrackPointDomainObject::LIVE_TRACK_ID => $liveTrack->getId(),
                LiveTrackPointDomainObject::RECORDED_AT => $point->recordedAt->toDateTimeString(),
                LiveTrackPointDomainObject::LATITUDE => $point->latitude,
                LiveTrackPointDomainObject::LONGITUDE => $point->longitude,
                LiveTrackPointDomainObject::ALTITUDE_M => $point->altitudeM,
                LiveTrackPointDomainObject::SPEED_MPS => $point->speedMps,
                LiveTrackPointDomainObject::DISTANCE_M => $point->distanceM,
                LiveTrackPointDomainObject::HEART_RATE => $point->heartRate,
            ],
            $kept,
        ));

        $latest = end($points);
        $ended = collect($points)->contains(fn(LiveTrackPointDTO $point) => $point->isEnd);

        return $this->liveTrackRepository->updateFromArray($liveTrack->getId(), [
            LiveTrackDomainObject::STATUS => $ended ? LiveTrackStatus::ENDED->name : LiveTrackStatus::ACTIVE->name,
            LiveTrackDomainObject::LAST_ERROR => null,
            LiveTrackDomainObject::LAST_POLLED_AT => $now,
            LiveTrackDomainObject::LAST_POINT_AT => $latest->recordedAt->toDateTimeString(),
            LiveTrackDomainObject::STILL_SINCE => $this->stillSince($liveTrack, $points)?->toDateTimeString(),
            LiveTrackDomainObject::LATITUDE => $latest->latitude,
            LiveTrackDomainObject::LONGITUDE => $latest->longitude,
            LiveTrackDomainObject::ALTITUDE_M => $latest->altitudeM ?? $liveTrack->getAltitudeM(),
            LiveTrackDomainObject::SPEED_MPS => $latest->speedMps,
            LiveTrackDomainObject::DISTANCE_M => $latest->distanceM ?? $liveTrack->getDistanceM(),
            LiveTrackDomainObject::DURATION_S => $latest->durationS ?? $liveTrack->getDurationS(),
            LiveTrackDomainObject::ELEVATION_GAIN_M => $latest->elevationGainM ?? $liveTrack->getElevationGainM(),
            LiveTrackDomainObject::HEART_RATE => $latest->heartRate,
            LiveTrackDomainObject::CADENCE => $latest->cadence,
            LiveTrackDomainObject::POINTS_COUNT => $liveTrack->getPointsCount() + count($kept),
        ]);
    }

    /**
     * Garmin answers a page of points at a time: a full page means more may follow, read now
     * (a participant who shares their link mid-race has a long trail to catch up on).
     *
     * @return LiveTrackPointDTO[]
     * @throws LiveTrackSessionNotFoundException|LiveTrackUnavailableException
     */
    private function readPoints(LiveTrackLinkDTO $link, ?CarbonImmutable $after): array
    {
        $points = [];
        for ($page = 0; $page < self::MAX_PAGES_PER_POLL; $page++) {
            $batch = $this->pointParser->parse($this->client->trackPoints($link, $after));
            $points = [...$points, ...$batch];
            $last = end($batch);
            if (count($batch) < self::FULL_PAGE || $last === false || ($after !== null && $last->recordedAt <= $after)) {
                break;
            }
            $after = $last->recordedAt;
        }

        return $points;
    }

    /**
     * A point every MIN_SECONDS_BETWEEN_POINTS, and always the last one and the end.
     *
     * @param LiveTrackPointDTO[] $points Oldest first
     * @return LiveTrackPointDTO[]
     */
    public function thin(array $points, ?CarbonImmutable $lastKeptAt = null): array
    {
        $kept = [];
        $lastIndex = count($points) - 1;
        foreach ($points as $index => $point) {
            $farEnough = $lastKeptAt === null
                || $lastKeptAt->diffInSeconds($point->recordedAt) >= self::MIN_SECONDS_BETWEEN_POINTS;
            if ($farEnough || $point->isEnd || $index === $lastIndex) {
                $kept[] = $point;
                $lastKeptAt = $point->recordedAt;
            }
        }

        return $kept;
    }

    /**
     * Since when the participant hasn't moved, or null while they move.
     *
     * @param LiveTrackPointDTO[] $points The new points, oldest first
     */
    public function stillSince(LiveTrackDomainObject $liveTrack, array $points): ?CarbonImmutable
    {
        $stillSince = $liveTrack->getStillSince() ? CarbonImmutable::parse($liveTrack->getStillSince()) : null;
        $previous = $liveTrack->getLatitude() !== null && $liveTrack->getLongitude() !== null && $liveTrack->getLastPointAt()
            ? [$liveTrack->getLatitude(), $liveTrack->getLongitude(), CarbonImmutable::parse($liveTrack->getLastPointAt())]
            : null;

        foreach ($points as $point) {
            if ($previous !== null) {
                [$latitude, $longitude, $at] = $previous;
                $seconds = max(1, $at->diffInSeconds($point->recordedAt));
                $speed = $this->metresBetween($latitude, $longitude, $point->latitude, $point->longitude) / $seconds;
                $still = $speed < self::STILL_SPEED_MPS && ($point->speedMps === null || $point->speedMps < self::STILL_SPEED_MPS);
                $stillSince = $still ? ($stillSince ?? $at) : null;
            }
            $previous = [$point->latitude, $point->longitude, $point->recordedAt];
        }

        return $stillSince;
    }

    private function metresBetween(float $latA, float $lngA, float $latB, float $lngB): float
    {
        $toRadians = M_PI / 180;
        $dLat = ($latB - $latA) * $toRadians;
        $dLng = ($lngB - $lngA) * $toRadians;
        $h = sin($dLat / 2) ** 2 + cos($latA * $toRadians) * cos($latB * $toRadians) * sin($dLng / 2) ** 2;

        return 2 * 6371000 * asin(min(1, sqrt($h)));
    }
}
