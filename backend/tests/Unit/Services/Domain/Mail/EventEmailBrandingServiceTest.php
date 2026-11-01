<?php

namespace Tests\Unit\Services\Domain\Mail;

use HiEvents\DomainObjects\Enums\ImageType;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\ImageDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\OrganizerSettingDomainObject;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Services\Domain\Mail\EventEmailBrandingService;
use Illuminate\Config\Repository;
use Mockery as m;
use Mockery\MockInterface;
use Tests\TestCase;

class EventEmailBrandingServiceTest extends TestCase
{
    private EventRepositoryInterface&MockInterface $eventRepository;
    private EventEmailBrandingService $service;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'app.frontend_url' => 'https://billets.example.com/',
            'app.email_logo_link_url' => 'https://example.com',
        ]);
        app()->setLocale('fr');

        $this->eventRepository = m::mock(EventRepositoryInterface::class);
        $this->service = new EventEmailBrandingService(app(Repository::class), $this->eventRepository);
    }

    public function testUsesTheEventAccentAndTheOrganizerImages(): void
    {
        $branding = $this->service->forEvent($this->createEvent(
            eventTheme: ['accent' => '#1d6fd8ff'],
            organizerTheme: ['accent' => '#251561'],
        ));

        $this->assertSame('#1d6fd8', $branding->accentColor);
        $this->assertSame('#fffcf8', $branding->accentTextColor);
        $this->assertSame('Boréal', $branding->organizerName);
        $this->assertStringEndsWith('organizer_logo/logo.jpg', $branding->organizerLogoUrl);
        $this->assertStringEndsWith('event_cover/cover.png', $branding->eventCoverUrl);
        $this->assertSame('Backyard Boréal', $branding->eventTitle);
        $this->assertSame('info@boreal.ca', $branding->supportEmail);
        $this->assertSame('https://billets.example.com', $branding->assetsUrl);
    }

    public function testFallsBackToTheOrganizerAccentThenDehorsOrange(): void
    {
        $fromOrganizer = $this->service->forEvent($this->createEvent(eventTheme: null, organizerTheme: ['accent' => '#FC0']));
        $this->assertSame('#ffcc00', $fromOrganizer->accentColor);
        $this->assertSame('#352924', $fromOrganizer->accentTextColor);

        $default = $this->service->forEvent($this->createEvent(eventTheme: null, organizerTheme: null));
        $this->assertSame(EventEmailBrandingService::DEHORS_ORANGE, $default->accentColor);
        // 20 % of the accent in the cream, like --public-accent-doux on the event page.
        $this->assertSame('#fedecb', $default->accentSoftColor);
    }

    public function testIgnoresUnsafeColors(): void
    {
        $branding = $this->service->forEvent($this->createEvent(
            eventTheme: ['accent' => 'red;background:url(x)'],
            organizerTheme: null,
            withImages: false,
        ));

        $this->assertSame(EventEmailBrandingService::DEHORS_ORANGE, $branding->accentColor);
        $this->assertNull($branding->organizerLogoUrl);
        $this->assertNull($branding->eventCoverUrl);
    }

    public function testDescribesTheDateAndThePlaceLikeTheEventPage(): void
    {
        $event = $this->createEvent(eventTheme: null, organizerTheme: null)
            ->setStartDate('2030-10-26 12:00:00')
            ->setEndDate('2030-10-26 20:00:00');
        $event->getEventSettings()->setLocationDetails([
            'venue_name' => 'Mont Orford',
            'address_line_1' => '4380 chemin du Parc',
            'city' => 'Orford',
            'state_or_region' => 'QC',
        ]);

        $branding = $this->service->forEvent($event);

        $this->assertSame('Samedi 26 octobre 2030 · 08:00 → 16:00', $branding->dateLine);
        $this->assertStringContainsString('(HAE)', $branding->timezoneLine);
        $this->assertSame('Mont Orford', $branding->placeLine);
        $this->assertSame('4380 chemin du Parc, Orford, QC', $branding->addressLine);
    }

    public function testAnOnlineEventHasNoAddress(): void
    {
        $event = $this->createEvent(eventTheme: null, organizerTheme: null);
        $event->getEventSettings()->setIsOnlineEvent(true)->setLocationDetails(['venue_name' => 'Ignored']);

        $branding = $this->service->forEvent($event);

        $this->assertSame(__('Online event'), $branding->placeLine);
        $this->assertNull($branding->addressLine);
    }

    public function testLoadsTheImagesAndTheOrganizerWhenTheEventCameWithout(): void
    {
        $loaded = $this->createEvent(eventTheme: ['accent' => '#1d6fd8'], organizerTheme: null);
        $this->eventRepository->shouldReceive('loadRelation')->andReturnSelf();
        $this->eventRepository->shouldReceive('findFirst')->once()->with(11)->andReturn($loaded);

        $bare = (new EventDomainObject())->setId(11)->setTitle('Backyard Boréal');
        $branding = $this->service->forEvent($bare, (new OrganizerDomainObject())->setName('Autre'));

        $this->assertSame('#1d6fd8', $branding->accentColor);
        $this->assertSame('Boréal', $branding->organizerName);
        $this->assertStringEndsWith('event_cover/cover.png', $branding->eventCoverUrl);
    }

    private function createEvent(?array $eventTheme, ?array $organizerTheme, bool $withImages = true): EventDomainObject
    {
        $organizerSettings = new OrganizerSettingDomainObject();
        $organizerSettings->setHomepageThemeSettings($organizerTheme ? json_encode($organizerTheme) : null);

        $organizer = new OrganizerDomainObject();
        $organizer->setName('Boréal');
        $organizer->setEmail('bonjour@boreal.ca');
        $organizer->setOrganizerSettings($organizerSettings);
        $organizer->setImages(collect($withImages ? [$this->image(ImageType::ORGANIZER_LOGO, 'organizer_logo/logo.jpg')] : []));

        $eventSettings = new EventSettingDomainObject();
        $eventSettings->setHomepageThemeSettings($eventTheme);
        $eventSettings->setSupportEmail('info@boreal.ca');

        $event = new EventDomainObject();
        $event->setId(11);
        $event->setTitle('Backyard Boréal');
        $event->setTimezone('America/Toronto');
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

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }
}
