<?php

namespace HiEvents\Services\Domain\LiveTrack;

use HiEvents\Exceptions\InvalidLiveTrackLinkException;
use HiEvents\Services\Domain\LiveTrack\DTO\LiveTrackLinkDTO;

/**
 * Finds the Garmin LiveTrack session in what the participant pasted: the link itself, or the
 * whole invitation email Garmin sent them.
 */
class LiveTrackLinkParser
{
    private const SESSION_PATTERN = '~livetrack\.garmin\.com/session/([0-9a-z-]{8,64})/token/([0-9a-z_-]{4,255})~i';

    private const PERSONAL_PATTERN = '~livetrack\.garmin\.com/(?!session/)[^\s/?#]+~i';

    /**
     * @throws InvalidLiveTrackLinkException
     */
    public function parse(string $input): LiveTrackLinkDTO
    {
        $text = trim($input);

        if (preg_match(self::SESSION_PATTERN, $text, $matches) === 1) {
            return new LiveTrackLinkDTO(sessionId: strtolower($matches[1]), token: $matches[2]);
        }

        if (preg_match(self::PERSONAL_PATTERN, $text) === 1) {
            throw new InvalidLiveTrackLinkException(__('This is your personal LiveTrack page. Share the link of the activity instead: it looks like livetrack.garmin.com/session/…/token/…'));
        }

        if (stripos($text, 'share.garmin.com') !== false) {
            throw new InvalidLiveTrackLinkException(__('inReach MapShare links are not supported yet. Share a Garmin LiveTrack link instead.'));
        }

        throw new InvalidLiveTrackLinkException(__('This is not a Garmin LiveTrack link. It looks like livetrack.garmin.com/session/…/token/…'));
    }
}
