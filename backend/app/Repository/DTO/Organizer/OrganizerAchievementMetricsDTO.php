<?php

namespace HiEvents\Repository\DTO\Organizer;

class OrganizerAchievementMetricsDTO
{
    public function __construct(
        public int   $events_created,
        // Logo and cover image, 0 to 2
        public int   $organizer_page_images,
        public bool  $payments_connected,
        public int   $live_events,
        public bool  $has_participant_order,
        public bool  $has_check_in,
        public int   $active_attendees,
        // People (by email) registered to at least two of the organizer's events
        public int   $regular_attendees,
        // Gross sales minus refunds, in the organizer's currency
        public float $net_sales,
        // Events that have ended with at least one participant
        public int   $events_held,
    )
    {
    }
}
