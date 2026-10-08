<?php

namespace Tests\Unit\Services\Domain\Mail;

use HiEvents\DomainObjects\Enums\ImageType;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\ImageDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\OrganizerSettingDomainObject;
use HiEvents\Services\Domain\Mail\EventEmailBrandingService;
use Illuminate\Config\Repository;
use Tests\TestCase;

class EventEmailBrandingServiceTest extends TestCase
{
    private EventEmailBrandingService $service;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'app.frontend_url' => 'https://billets.example.com/',
            'app.email_logo_link_url' => 'https://example.com',
        ]);

        $this->service = new EventEmailBrandingService(app(Repository::class));
    }

    public function testUsesEventThemeAndImages(): void
    {
        $event = $this->createEvent(
            eventTheme: ['accent' => '#180d40de', 'background' => '#fff6e8ff', 'font_family' => 'Raleway'],
            organizerTheme: ['accent' => '#251561e6', 'background' => '#fff5e6ff', 'font_family' => 'Plus Jakarta Sans'],
        );

        $branding = $this->service->forEvent($event);

        $this->assertSame('#180d40', $branding->accentColor);
        $this->assertSame('#ffffff', $branding->accentTextColor);
        $this->assertSame('#fff6e8', $branding->backgroundColor);
        $this->assertStringStartsWith("'Raleway'", $branding->fontFamily);
        $this->assertStringContainsString('family=Raleway', $branding->fontStylesheetUrl);
        $this->assertSame('Boréal', $branding->organizerName);
        $this->assertStringEndsWith('organizer_logo/logo.jpg', $branding->organizerLogoUrl);
        $this->assertStringEndsWith('event_cover/cover.png', $branding->eventCoverUrl);
        $this->assertSame('https://billets.example.com/logos/dehors-billetterie-clair.png', $branding->platformLogoUrl);
        $this->assertSame('https://example.com', $branding->platformUrl);
    }

    public function testFallsBackToOrganizerThemeThenDefaults(): void
    {
        $branding = $this->service->forEvent($this->createEvent(
            eventTheme: null,
            organizerTheme: ['accent' => '#FC0', 'font_family' => 'Plus Jakarta Sans'],
        ));

        $this->assertSame('#ffcc00', $branding->accentColor);
        $this->assertSame('#1f1a33', $branding->accentTextColor);
        $this->assertSame('#f6f3ee', $branding->backgroundColor);
        $this->assertStringContainsString('family=Plus+Jakarta+Sans', $branding->fontStylesheetUrl);
    }

    public function testIgnoresUnsafeThemeValues(): void
    {
        $branding = $this->service->forEvent($this->createEvent(
            eventTheme: ['accent' => 'red;background:url(x)', 'font_family' => "Arial'; color:red"],
            organizerTheme: null,
            withImages: false,
        ));

        $this->assertSame('#1f1a33', $branding->accentColor);
        $this->assertNull($branding->fontStylesheetUrl);
        $this->assertStringNotContainsString('color:red', $branding->fontFamily);
        $this->assertNull($branding->organizerLogoUrl);
        $this->assertNull($branding->eventCoverUrl);
    }

    private function createEvent(?array $eventTheme, ?array $organizerTheme, bool $withImages = true): EventDomainObject
    {
        $organizerSettings = new OrganizerSettingDomainObject();
        $organizerSettings->setHomepageThemeSettings($organizerTheme ? json_encode($organizerTheme) : null);

        $organizer = new OrganizerDomainObject();
        $organizer->setName('Boréal');
        $organizer->setOrganizerSettings($organizerSettings);
        $organizer->setImages(collect($withImages ? [$this->image(ImageType::ORGANIZER_LOGO, 'organizer_logo/logo.jpg')] : []));

        $eventSettings = new EventSettingDomainObject();
        $eventSettings->setHomepageThemeSettings($eventTheme);

        $event = new EventDomainObject();
        $event->setEventSettings($eventSettings);
        $event->setOrganizer($organizer);
        $event->setImages(collect($withImages ? [$this->image(ImageType::EVENT_COVER, 'event_cover/cover.png')] : []));

        return $event;
    }

    private function image(ImageType $type, string $path): ImageDomainObject
    {
        $image = new ImageDomainObject();
        $image->setType($type->name);
        $image->setPath($path);

        return $image;
    }
}
