<?php

namespace HiEvents\DomainObjects\Status;

use HiEvents\DomainObjects\Enums\BaseEnum;

enum LiveTrackStatus
{
    use BaseEnum;

    // The link is saved, no position yet: the activity hasn't started.
    case WAITING;
    case ACTIVE;
    case ENDED;
    // Garmin no longer knows the session (deleted, or the link was mistyped).
    case FAILED;

    /**
     * @return string[]
     */
    public static function polled(): array
    {
        return [self::WAITING->name, self::ACTIVE->name];
    }
}
