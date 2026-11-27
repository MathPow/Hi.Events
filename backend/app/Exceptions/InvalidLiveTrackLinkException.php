<?php

namespace HiEvents\Exceptions;

use Exception;

/** A shared link that is not a Garmin LiveTrack session link; the message is for the participant. */
class InvalidLiveTrackLinkException extends Exception
{
}
