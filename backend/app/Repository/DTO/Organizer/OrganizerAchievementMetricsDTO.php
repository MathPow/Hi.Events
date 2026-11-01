<?php

namespace HiEvents\Repository\DTO\Organizer;

class OrganizerAchievementMetricsDTO
{
    public function __construct(
        public int  $events_created,
        // An item other than a ticket sold in a participant's order
        public bool $merchandise_sold,
        public int  $active_attendees,
        // People (by email) registered to at least two of the organizer's events
        public int  $returning_attendees,
        // Events that have ended with at least one participant
        public int  $events_held,
        // Participants' orders that used a promo code
        public int  $promo_code_orders,
        // Regions (in Québec, the administrative regions) of the events held
        public int  $regions_held,
        // People (by email) whose very first registration on the platform was to one of the organizer's events
        public int  $first_time_attendees,
    )
    {
    }
}
