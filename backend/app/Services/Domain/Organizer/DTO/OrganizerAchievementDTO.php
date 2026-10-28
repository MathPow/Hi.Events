<?php

namespace HiEvents\Services\Domain\Organizer\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class OrganizerAchievementDTO extends BaseDataObject
{
    public function __construct(
        public string  $key,
        public int     $current,
        public int     $target,
        public ?string $earned_at,
        // Earned, and the organizer hasn't seen the window that announces it yet
        public bool    $is_new,
    )
    {
    }
}
