<?php

namespace HiEvents\Exceptions;

use Exception;

/** Garmin LiveTrack didn't answer as expected (down, blocked, or its format changed). */
class LiveTrackUnavailableException extends Exception
{
}
