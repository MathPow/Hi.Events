<?php

namespace HiEvents\Services\Domain\Waiver;

use Carbon\CarbonImmutable;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\Generated\WaiverDomainObjectAbstract;
use HiEvents\DomainObjects\WaiverDomainObject;
use HiEvents\Repository\Interfaces\WaiverRepositoryInterface;
use Illuminate\Database\DatabaseManager;
use Illuminate\Database\UniqueConstraintViolationException;
use Throwable;

/**
 * The waiver of an event: each version of its text is kept the first time a
 * participant signs it, so a signature always points to the words it agreed
 * to, even after the organizer edits them.
 */
class WaiverService
{
    // The age of majority in Quebec: younger, a parent or guardian signs.
    public const ADULT_AGE = 18;

    public function __construct(
        private readonly WaiverRepositoryInterface $waiverRepository,
        private readonly DatabaseManager           $databaseManager,
    )
    {
    }

    /**
     * @throws Throwable
     */
    public function currentVersion(int $eventId, string $text): WaiverDomainObject
    {
        $where = [
            WaiverDomainObjectAbstract::EVENT_ID => $eventId,
            WaiverDomainObjectAbstract::TEXT_HASH => hash('sha256', $text),
        ];

        $existing = $this->waiverRepository->findFirstWhere($where);
        if ($existing) {
            return $existing;
        }

        // Two orders may sign a new version at once: the second one finds the first's row.
        // The savepoint keeps the order's own transaction alive after the conflict.
        try {
            return $this->databaseManager->transaction(fn() => $this->waiverRepository->create([
                ...$where,
                WaiverDomainObjectAbstract::TEXT => $text,
            ]));
        } catch (UniqueConstraintViolationException) {
            return $this->waiverRepository->findFirstWhere($where);
        }
    }

    /**
     * Whether someone born on $dateOfBirth (YYYY-MM-DD) is under ADULT_AGE on
     * the event's day, in its time zone. An unreadable date is not a minor:
     * the date of birth question checks it on its own.
     */
    public function isMinorOnEventDay(?string $dateOfBirth, EventDomainObject $event): bool
    {
        if (!$dateOfBirth || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateOfBirth)) {
            return false;
        }

        $born = CarbonImmutable::createFromFormat('!Y-m-d', $dateOfBirth);
        if (!$born) {
            return false;
        }

        $eventDay = CarbonImmutable::parse($event->getStartDate(), 'UTC')
            ->setTimezone($event->getTimezone() ?: 'UTC')
            ->toDateString();

        // Dates as YYYY-MM-DD compare in order as strings.
        return $born->addYears(self::ADULT_AGE)->toDateString() > $eventDay;
    }
}
