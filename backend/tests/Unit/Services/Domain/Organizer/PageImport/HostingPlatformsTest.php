<?php

namespace Tests\Unit\Services\Domain\Organizer\PageImport;

use HiEvents\Services\Domain\Organizer\PageImport\HostingPlatforms;
use Tests\TestCase;

class HostingPlatformsTest extends TestCase
{
    private HostingPlatforms $platforms;

    protected function setUp(): void
    {
        parent::setUp();
        $this->platforms = new HostingPlatforms();
    }

    public function testRecognizesPlatformsInEveryCountryAndSubdomain(): void
    {
        $this->assertSame('Eventbrite', $this->platforms->of('https://www.eventbrite.ca/o/gldn-grvs-47130468943'));
        $this->assertSame('Eventbrite', $this->platforms->of('https://www.eventbrite.co.uk/e/un-evenement-123'));
        $this->assertSame('Lepointdevente', $this->platforms->of('https://lepointdevente.com/billets/CLB261126001'));
        $this->assertSame('Lepointdevente', $this->platforms->of('https://club.lepointdevente.com/'));
        $this->assertSame('Facebook', $this->platforms->of('https://m.facebook.com/dehorsqc'));
    }

    public function testAClubWebsiteIsNotAPlatform(): void
    {
        $this->assertNull($this->platforms->of('https://dehorsqc.com/'));
        $this->assertNull($this->platforms->of('https://www.luma.ca/'));
        $this->assertNull($this->platforms->of('https://monuniverse.com/'));
        $this->assertNull($this->platforms->of('https://eventbrite-fans.ca/'));
        $this->assertNull($this->platforms->of('https://www.instagram.com/dehorsqc/'));
    }

    public function testOnlyThePlatformItselfIsAHomePage(): void
    {
        $this->assertTrue($this->platforms->isHomePage('https://www.eventbrite.ca/'));
        $this->assertTrue($this->platforms->isHomePage('https://lepointdevente.com'));
        $this->assertTrue($this->platforms->isHomePage('https://www.eventbrite.co.uk/'));
        $this->assertFalse($this->platforms->isHomePage('https://club.lepointdevente.com/'));
        $this->assertFalse($this->platforms->isHomePage('https://www.eventbrite.ca/o/gldn-grvs-47130468943'));
    }

    public function testRecognizesThePlatformsOwnAccounts(): void
    {
        $this->assertTrue($this->platforms->isNamedAfter('Eventbrite', 'eventbritehelp'));
        $this->assertTrue($this->platforms->isNamedAfter('Eventbrite', 'Eventbrite'));
        $this->assertTrue($this->platforms->isNamedAfter('Lepointdevente', 'lepointdevente-com'));
        $this->assertTrue($this->platforms->isNamedAfter('Lepointdevente', 'lepointdevente.com'));
        $this->assertTrue($this->platforms->isNamedAfter('Race Roster', 'race.roster'));
        $this->assertTrue($this->platforms->isNamedAfter('X', 'x'));
        $this->assertFalse($this->platforms->isNamedAfter('X', 'xavier'));
        $this->assertFalse($this->platforms->isNamedAfter('Eventbrite', 'gldngrvs'));
    }

    public function testRecognizesGenericShareImagesButNotEventImages(): void
    {
        $this->assertTrue($this->platforms->isGenericImage('https://tpos.s3.amazonaws.com/logos/lepointdevente.com-ogp.gif'));
        $this->assertTrue($this->platforms->isGenericImage('https://cdn.lepointdevente.com/themes/tpos/ogp-img-fr-5f32b556.gif'));
        $this->assertFalse($this->platforms->isGenericImage('https://tpos.s3.amazonaws.com/events/CLB/26/11/26/001/clb261126001-1152x648-fr-6a2ff62d.png'));
        $this->assertFalse($this->platforms->isGenericImage('https://www.eventbrite.ca/_next/image?url=https%3A%2F%2Fimg.evbuc.com%2Flogo.png'));
    }
}
