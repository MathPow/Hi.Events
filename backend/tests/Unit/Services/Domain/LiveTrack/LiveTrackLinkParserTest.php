<?php

namespace Tests\Unit\Services\Domain\LiveTrack;

use HiEvents\Exceptions\InvalidLiveTrackLinkException;
use HiEvents\Services\Domain\LiveTrack\LiveTrackLinkParser;
use Tests\TestCase;

class LiveTrackLinkParserTest extends TestCase
{
    private LiveTrackLinkParser $parser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->parser = new LiveTrackLinkParser();
    }

    public function test_reads_the_session_and_token_of_a_link(): void
    {
        $link = $this->parser->parse('https://livetrack.garmin.com/session/1A2B3C4D-1111-2222-3333-444455556666/token/AbC123xyz');

        $this->assertSame('1a2b3c4d-1111-2222-3333-444455556666', $link->sessionId);
        $this->assertSame('AbC123xyz', $link->token);
        $this->assertSame('https://livetrack.garmin.com/session/1a2b3c4d-1111-2222-3333-444455556666/token/AbC123xyz', $link->url());
    }

    public function test_finds_the_link_in_the_whole_garmin_email(): void
    {
        $email = "Marie vous invite à suivre son activité en direct.\n\nSuivre maintenant :\n"
            . "<https://livetrack.garmin.com/session/aaaa1111-bb22-cc33-dd44-eeeeee555555/token/7F3K9Q?utm_source=email>\n\nGarmin";

        $link = $this->parser->parse($email);

        $this->assertSame('aaaa1111-bb22-cc33-dd44-eeeeee555555', $link->sessionId);
        $this->assertSame('7F3K9Q', $link->token);
    }

    public function test_accepts_a_link_without_its_scheme(): void
    {
        $link = $this->parser->parse('  livetrack.garmin.com/session/aaaa1111-bb22-cc33-dd44-eeeeee555555/token/XYZ987  ');

        $this->assertSame('XYZ987', $link->token);
    }

    public function test_refuses_a_personal_livetrack_page(): void
    {
        $this->expectException(InvalidLiveTrackLinkException::class);
        $this->expectExceptionMessage('personal LiveTrack page');

        $this->parser->parse('https://livetrack.garmin.com/marie-coureuse');
    }

    public function test_refuses_an_inreach_link(): void
    {
        $this->expectException(InvalidLiveTrackLinkException::class);
        $this->expectExceptionMessage('inReach');

        $this->parser->parse('https://share.garmin.com/MarieT');
    }

    public function test_refuses_anything_else(): void
    {
        $this->expectException(InvalidLiveTrackLinkException::class);

        $this->parser->parse('https://www.strava.com/activities/123');
    }
}
