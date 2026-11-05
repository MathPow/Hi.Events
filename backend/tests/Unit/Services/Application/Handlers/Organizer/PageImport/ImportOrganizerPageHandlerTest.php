<?php

namespace Tests\Unit\Services\Application\Handlers\Organizer\PageImport;

use HiEvents\Services\Application\Handlers\Organizer\PageImport\DTO\ImportOrganizerPageDTO;
use HiEvents\Services\Application\Handlers\Organizer\PageImport\DTO\OrganizerPageSuggestionDTO;
use HiEvents\Services\Application\Handlers\Organizer\PageImport\ImportOrganizerPageHandler;
use HiEvents\Services\Domain\Assistant\AssistantQuotaService;
use HiEvents\Services\Domain\Organizer\PageImport\AccentColorPicker;
use HiEvents\Services\Domain\Organizer\PageImport\ChosenImage;
use HiEvents\Services\Domain\Organizer\PageImport\HostingPlatforms;
use HiEvents\Services\Domain\Organizer\PageImport\PageImageChooser;
use HiEvents\Services\Domain\Organizer\PageImport\PageTexts;
use HiEvents\Services\Domain\Organizer\PageImport\PageTextWriter;
use HiEvents\Services\Domain\Organizer\PageImport\WebsiteReader;
use HiEvents\Services\Infrastructure\WebPage\FetchedWebPage;
use HiEvents\Services\Infrastructure\WebPage\SafeWebFetcher;
use HiEvents\Services\Infrastructure\WebPage\WebPageFetchException;
use Mockery as m;
use Tests\TestCase;

class ImportOrganizerPageHandlerTest extends TestCase
{
    private const EVENTBRITE_PAGE = <<<'HTML'
        <html><head>
            <title>THE AFTER Tickets | Eventbrite</title>
            <meta property="og:site_name" content="Eventbrite">
            <meta property="og:title" content="THE AFTER">
            <meta name="description" content="Eventbrite - GLDN GRVS presents THE AFTER at Birra &amp; Basta, Québec.">
            <meta property="og:image" content="https://img.evbuc.com/evenement.jpg">
            <meta name="theme-color" content="#F6682F">
            <link rel="apple-touch-icon" href="https://cdn.evbstatic.com/icone.png">
            <script type="application/ld+json">{"@type": "SocialEvent", "organizer": {"@type": "Organization", "name": "GLDN GRVS"}}</script>
        </head><body>
            <h1>THE AFTER</h1>
            <a href="https://www.facebook.com/Eventbrite">Facebook</a>
            <a href="https://www.instagram.com/eventbrite/">Instagram</a>
            <a href="https://www.instagram.com/gldngrvs/">Instagram de l'organisateur</a>
        </body></html>
        HTML;

    private SafeWebFetcher $fetcher;

    private PageImageChooser $imageChooser;

    private AccentColorPicker $accentPicker;

    private PageTextWriter $textWriter;

    private AssistantQuotaService $quota;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fetcher = m::mock(SafeWebFetcher::class);
        $this->imageChooser = m::mock(PageImageChooser::class);
        $this->accentPicker = m::mock(AccentColorPicker::class);
        $this->textWriter = m::mock(PageTextWriter::class);
        $this->quota = m::mock(AssistantQuotaService::class);

        $this->fetcher->shouldReceive('normalize')->andReturnUsing(fn(string $url) => $url);
        $this->quota->shouldReceive('consume')->andReturnTrue()->byDefault();
    }

    private function import(string $url, string $html): OrganizerPageSuggestionDTO
    {
        $this->fetcher->shouldReceive('fetch')->once()->andReturn(new FetchedWebPage(
            url: $url,
            contentType: 'text/html',
            charset: 'utf-8',
            body: $html,
        ));

        $handler = new ImportOrganizerPageHandler(
            $this->fetcher,
            new WebsiteReader(),
            $this->imageChooser,
            $this->accentPicker,
            $this->textWriter,
            $this->quota,
            new HostingPlatforms(),
        );

        return $handler->handle(new ImportOrganizerPageDTO(accountId: 1, userId: 2, url: $url));
    }

    private function image(string $url): ChosenImage
    {
        return new ChosenImage(url: $url, mimeType: 'image/jpeg', width: 1200, height: 600, bytes: 'octets');
    }

    public function testOnATicketingPageKeepsOnlyWhatBelongsToTheOrganizer(): void
    {
        $this->textWriter->shouldReceive('isAvailable')->andReturnFalse();
        $this->imageChooser->shouldNotReceive('logo');
        $this->accentPicker->shouldNotReceive('pick');
        $this->imageChooser->shouldReceive('cover')
            ->once()
            ->with(['https://img.evbuc.com/evenement.jpg'])
            ->andReturn($this->image('https://img.evbuc.com/evenement.jpg'));

        $suggestion = $this->import('https://www.eventbrite.ca/e/the-after-tickets-2003973066387', self::EVENTBRITE_PAGE);

        $this->assertSame('platform', $suggestion->source);
        $this->assertSame('Eventbrite', $suggestion->platform);
        $this->assertSame('GLDN GRVS', $suggestion->name);
        $this->assertNull($suggestion->description);
        $this->assertNull($suggestion->logo);
        $this->assertNull($suggestion->accent);
        $this->assertStringStartsWith('data:image/jpeg;base64,', $suggestion->cover);
        $this->assertSame([['platform' => 'instagram', 'handle' => 'gldngrvs']], $suggestion->social_links);
    }

    public function testTheAssistantIsToldAboutThePlatform(): void
    {
        $this->textWriter->shouldReceive('isAvailable')->andReturnTrue();
        $this->textWriter->shouldReceive('write')
            ->once()
            ->with(m::any(), 1, 2, 'Eventbrite')
            ->andReturn(new PageTexts(name: 'GLDN GRVS', descriptionHtml: '<p>Nous organisons des soirées.</p>', faqs: []));
        $this->imageChooser->shouldReceive('cover')->andReturnNull();

        $suggestion = $this->import('https://www.eventbrite.ca/e/the-after-tickets-2003973066387', self::EVENTBRITE_PAGE);

        $this->assertSame('<p>Nous organisons des soirées.</p>', $suggestion->description);
        $this->assertTrue($suggestion->written_by_assistant);
    }

    public function testFindsTheOrganizerInTheTitleWhenThePageDoesNotDeclareIt(): void
    {
        $this->textWriter->shouldReceive('isAvailable')->andReturnFalse();
        $this->imageChooser->shouldReceive('cover')->andReturnNull();

        $suggestion = $this->import(
            'https://lepointdevente.com/billets/CLB261126001',
            '<html><head><title>INSPIRE MUSIQUE présente LAURENCE NERBONNE | NEXT - Lepointdevente.com</title></head><body>Un spectacle</body></html>',
        );

        $this->assertSame('INSPIRE MUSIQUE', $suggestion->name);
    }

    public function testAnOrganizerPageGivesItsOnlyName(): void
    {
        $this->textWriter->shouldReceive('isAvailable')->andReturnFalse();
        $this->imageChooser->shouldReceive('cover')->andReturnNull();

        $suggestion = $this->import(
            'https://www.eventbrite.ca/o/gldn-grvs-47130468943',
            '<html><head><title>GLDN GRVS</title></head><body>Événements à venir</body></html>',
        );

        $this->assertSame('GLDN GRVS', $suggestion->name);
    }

    public function testDropsTheGenericShareImageOfThePlatform(): void
    {
        $this->textWriter->shouldReceive('isAvailable')->andReturnFalse();
        $this->imageChooser->shouldReceive('cover')->once()->with([])->andReturnNull();

        $this->import(
            'https://lepointdevente.com/billets/CLB261126001',
            '<html><head><title>Un spectacle</title><meta property="og:image" content="https://tpos.s3.amazonaws.com/logos/lepointdevente.com-ogp.gif"></head><body>Un spectacle</body></html>',
        );
    }

    public function testThePlatformHomePageIsRefused(): void
    {
        $this->expectException(WebPageFetchException::class);

        $this->import('https://www.eventbrite.ca/', self::EVENTBRITE_PAGE);
    }

    public function testAnEmptyFacebookPageGivesItsHandleWithoutSpendingAnAssistantTurn(): void
    {
        $this->textWriter->shouldNotReceive('write');
        $this->quota->shouldNotReceive('consume');
        $this->imageChooser->shouldReceive('cover')->andReturnNull();

        $suggestion = $this->import(
            'https://www.facebook.com/dehorsqc',
            '<html><head><title>Facebook</title><link rel="icon" href="https://static.xx.fbcdn.net/rsrc.php/icone.png"></head><body></body></html>',
        );

        $this->assertSame('Facebook', $suggestion->platform);
        $this->assertNull($suggestion->name);
        $this->assertNull($suggestion->logo);
        $this->assertSame([['platform' => 'facebook', 'handle' => 'dehorsqc']], $suggestion->social_links);
    }

    public function testAClubWebsiteStillGivesItsLogoAndColor(): void
    {
        $logo = $this->image('https://club.ca/logo.png');
        $this->textWriter->shouldReceive('isAvailable')->andReturnFalse();
        $this->imageChooser->shouldReceive('logo')->once()->andReturn($logo);
        $this->imageChooser->shouldReceive('cover')->once()->andReturnNull();
        $this->accentPicker->shouldReceive('pick')->once()->with('#1A7F5A', 'octets')->andReturn('#1A7F5A');

        $suggestion = $this->import(
            'https://club.ca/',
            '<html><head><title>Club de trail</title><meta name="theme-color" content="#1a7f5a"><link rel="icon" href="/logo.png"></head><body><a href="https://www.instagram.com/club/">Instagram</a>Nos sorties</body></html>',
        );

        $this->assertSame('website', $suggestion->source);
        $this->assertNull($suggestion->platform);
        $this->assertSame('Club de trail', $suggestion->name);
        $this->assertSame('#1A7F5A', $suggestion->accent);
        $this->assertSame([['platform' => 'instagram', 'handle' => 'club']], $suggestion->social_links);
    }

    public function testAnInstagramProfileStillGivesItsPictureAsLogo(): void
    {
        $picture = $this->image('https://cdn.instagram.com/profil.jpg');
        $this->textWriter->shouldReceive('isAvailable')->andReturnFalse();
        $this->imageChooser->shouldReceive('logo')->once()->with(['https://cdn.instagram.com/profil.jpg'])->andReturn($picture);
        $this->imageChooser->shouldNotReceive('cover');
        $this->accentPicker->shouldReceive('pick')->andReturnNull();

        $suggestion = $this->import(
            'https://www.instagram.com/dehorsqc/',
            '<html><head><title>Dehors Qc (@dehorsqc) • Instagram</title><meta property="og:image" content="https://cdn.instagram.com/profil.jpg"></head><body>bio</body></html>',
        );

        $this->assertSame('instagram', $suggestion->source);
        $this->assertNull($suggestion->platform);
        $this->assertNotNull($suggestion->logo);
        $this->assertNull($suggestion->cover);
        $this->assertSame([['platform' => 'instagram', 'handle' => 'dehorsqc']], $suggestion->social_links);
    }
}
