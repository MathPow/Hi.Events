<?php

namespace HiEvents\DomainObjects\Enums;

use HiEvents\Repository\DTO\Organizer\OrganizerAchievementMetricsDTO;

/**
 * The ten achievements an organizer can earn, in the order they are shown: getting
 * set up first, then the first sales, then the milestones.
 * Kept in sync with frontend/src/components/common/OrganizerAchievements/achievements.tsx
 * (icon, title, description) — update both when adding/removing achievements.
 */
enum OrganizerAchievement: string
{
    use BaseEnum;

    case FirstEvent = 'first_event';
    case OrganizerPage = 'organizer_page';
    case PaymentsConnected = 'payments_connected';
    case EventPublished = 'event_published';
    case FirstOrder = 'first_order';
    case FirstCheckIn = 'first_check_in';
    case HundredAttendees = 'hundred_attendees';
    case RegularAttendees = 'regular_attendees';
    case SalesSummit = 'sales_summit';
    case FullSeason = 'full_season';

    public function target(): int
    {
        return match ($this) {
            self::OrganizerPage => 2,
            self::HundredAttendees => 100,
            self::RegularAttendees => 10,
            self::SalesSummit => 10_000,
            self::FullSeason => 5,
            default => 1,
        };
    }

    /**
     * Where the organizer stands, on the same scale as target().
     */
    public function progress(OrganizerAchievementMetricsDTO $metrics): int
    {
        return match ($this) {
            self::FirstEvent => $metrics->events_created,
            self::OrganizerPage => $metrics->organizer_page_images,
            self::PaymentsConnected => (int)$metrics->payments_connected,
            self::EventPublished => $metrics->live_events,
            self::FirstOrder => (int)$metrics->has_participant_order,
            self::FirstCheckIn => (int)$metrics->has_check_in,
            self::HundredAttendees => $metrics->active_attendees,
            self::RegularAttendees => $metrics->regular_attendees,
            self::SalesSummit => (int)floor($metrics->net_sales),
            self::FullSeason => $metrics->events_held,
        };
    }
}
