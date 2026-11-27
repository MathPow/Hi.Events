<?php

namespace HiEvents\Exceptions;

use Exception;

/** Garmin no longer knows this LiveTrack session (deleted, expired, or a mistyped link). */
class LiveTrackSessionNotFoundException extends Exception
{
}
