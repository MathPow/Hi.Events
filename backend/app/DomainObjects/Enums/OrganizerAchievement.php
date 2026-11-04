<?php

namespace HiEvents\DomainObjects\Enums;

use HiEvents\Repository\DTO\Organizer\OrganizerAchievementMetricsDTO;

/**
 * The achievements an organizer can earn, in the order they are shown.
 * Kept in sync with frontend/src/components/common/OrganizerAchievements/achievements.ts
 * (icon, title, description) — update both when adding/removing achievements.
 * An earned achievement is saved under its value: a new rule needs a new value.
 */
enum OrganizerAchievement: string
{
    use BaseEnum;

    case FirstEvent = 'first_event';
    case FirstMerchandiseSale = 'first_merchandise_sale';
    case Club100 = 'hundred_attendees';
    case Club250 = 'attendees_250';
    case Club500 = 'attendees_500';
    case Club1000 = 'attendees_1000';
    case Club5000 = 'attendees_5000';
    case Club69420 = 'attendees_69420';
    case ReturningAttendees = 'returning_attendees';
    case HatTrick = 'hat_trick';
    case SecretCode = 'promo_code_uses';
    case QuebecTour = 'quebec_tour';
    case Rookies = 'first_time_attendees';

    public function target(): int
    {
        return match ($this) {
            self::Club100 => 100,
            self::Club250 => 250,
            self::Club500 => 500,
            self::Club1000 => 1_000,
            self::Club5000 => 5_000,
            self::Club69420 => 69_420,
            self::ReturningAttendees => 25,
            self::HatTrick => 3,
            self::SecretCode => 10,
            self::QuebecTour => 3,
            self::Rookies => 50,
            default => 1,
        };
    }

    /**
     * How hard it is to earn: the organizer's public page shows the hardest first.
     */
    public function difficulty(): int
    {
        return match ($this) {
            self::Club69420 => 13,
            self::Club5000 => 12,
            self::Club1000 => 11,
            self::Club500 => 10,
            self::ReturningAttendees => 9,
            self::QuebecTour => 8,
            self::Club250 => 7,
            self::Rookies => 6,
            self::HatTrick => 5,
            self::SecretCode => 4,
            self::Club100 => 3,
            self::FirstMerchandiseSale => 2,
            self::FirstEvent => 1,
        };
    }

    /**
     * Where the organizer stands, on the same scale as target().
     */
    public function progress(OrganizerAchievementMetricsDTO $metrics): int
    {
        return match ($this) {
            self::FirstEvent => $metrics->events_created,
            self::FirstMerchandiseSale => (int)$metrics->merchandise_sold,
            self::Club100,
            self::Club250,
            self::Club500,
            self::Club1000,
            self::Club5000,
            self::Club69420 => $metrics->active_attendees,
            self::ReturningAttendees => $metrics->returning_attendees,
            self::HatTrick => $metrics->events_held,
            self::SecretCode => $metrics->promo_code_orders,
            self::QuebecTour => $metrics->regions_held,
            self::Rookies => $metrics->first_time_attendees,
        };
    }
}
