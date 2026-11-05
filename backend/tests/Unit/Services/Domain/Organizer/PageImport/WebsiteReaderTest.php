<?php

namespace Tests\Unit\Services\Domain\Organizer\PageImport;

use HiEvents\Services\Domain\Organizer\PageImport\WebsiteReader;
use HiEvents\Services\Infrastructure\WebPage\FetchedWebPage;
use Tests\TestCase;

class WebsiteReaderTest extends TestCase
{
    private const HTML = <<<'HTML'
        <!doctype html>
        <html lang="fr">
        <head>
            <meta charset="utf-8">
            <title>Accueil | Club de trail des Laurentides</title>
            <meta name="description" content="Sorties de trail chaque samedi à Saint-Sauveur.">
            <meta property="og:site_name" content="Trail Laurentides">
            <meta property="og:image" content="/images/couverture.jpg">
            <meta name="theme-color" content="#1a7f5a">
            <link rel="icon" href="/favicon-32.png" sizes="32x32">
            <link rel="apple-touch-icon" href="/apple-touch-icon.png">
            <script type="application/ld+json">{"@type": "SportsClub", "logo": "https://cdn.example.com/logo-jsonld.png"}</script>
            <script>var tracking = "ne pas lire";</script>
        </head>
        <body>
            <header><img class="site-logo" src="/img/logo.png" alt="Trail Laurentides"></header>
            <main><h1>Courir ensemble</h1><p>Départ au chalet à 8 h.</p></main>
            <footer>
                <a href="https://www.instagram.com/traillaurentides/">Instagram</a>
                <a href="https://www.instagram.com/p/C1234/">Une publication</a>
                <a href="https://www.facebook.com/sharer/sharer.php?u=x">Partager</a>
                <a href="https://facebook.com/TrailLaurentides">Facebook</a>
                <a href="https://www.strava.com/clubs/trail-laurentides">Strava</a>
                <a href="mailto:info@example.com">Écrire</a>
            </footer>
        </body>
        </html>
        HTML;

    private function snapshot(): \HiEvents\Services\Domain\Organizer\PageImport\WebsiteSnapshot
    {
        return (new WebsiteReader())->read(new FetchedWebPage(
            url: 'https://traillaurentides.ca/accueil',
            contentType: 'text/html',
            charset: 'utf-8',
            body: self::HTML,
        ));
    }

    public function testReadsNamesDescriptionsAndColor(): void
    {
        $snapshot = $this->snapshot();

        $this->assertSame(['Trail Laurentides', 'Accueil | Club de trail des Laurentides'], $snapshot->names);
        $this->assertSame(['Sorties de trail chaque samedi à Saint-Sauveur.'], $snapshot->descriptions);
        $this->assertSame('#1A7F5A', $snapshot->themeColor);
    }

    public function testListsLogosFromTheDeclaredOneToTheIcons(): void
    {
        $this->assertSame([
            'https://cdn.example.com/logo-jsonld.png',
            'https://traillaurentides.ca/img/logo.png',
            'https://traillaurentides.ca/apple-touch-icon.png',
            'https://traillaurentides.ca/favicon-32.png',
        ], $this->snapshot()->logoCandidates);
        $this->assertSame(['https://traillaurentides.ca/images/couverture.jpg'], $this->snapshot()->coverCandidates);
    }

    public function testKeepsOneAccountPerNetworkAndSkipsShareLinksAndPosts(): void
    {
        $this->assertSame([
            ['platform' => 'instagram', 'handle' => 'traillaurentides'],
            ['platform' => 'facebook', 'handle' => 'TrailLaurentides'],
            ['platform' => 'strava', 'handle' => 'trail-laurentides'],
        ], $this->snapshot()->socialLinks);
    }

    public function testTheTextLeavesScriptsOut(): void
    {
        $text = $this->snapshot()->text;

        $this->assertStringContainsString('Courir ensemble', $text);
        $this->assertStringContainsString('Départ au chalet à 8 h.', $text);
        $this->assertStringNotContainsString('ne pas lire', $text);
    }

    public function testRecognizesProfileAddresses(): void
    {
        $reader = new WebsiteReader();

        $this->assertSame(['instagram', 'dehors.qc'], $reader->socialLink('https://instagram.com/dehors.qc'));
        $this->assertSame(['tiktok', 'dehorsqc'], $reader->socialLink('https://www.tiktok.com/@dehorsqc'));
        $this->assertSame(['youtube', 'dehors'], $reader->socialLink('https://youtube.com/@dehors'));
        $this->assertSame(['linkedin', 'dehors-qc'], $reader->socialLink('https://ca.linkedin.com/company/dehors-qc/'));
        $this->assertSame(['facebook', 'profile.php?id=1234'], $reader->socialLink('https://www.facebook.com/profile.php?id=1234'));
        $this->assertNull($reader->socialLink('https://www.instagram.com/explore/'));
        $this->assertNull($reader->socialLink('https://twitter.com/intent/tweet?text=x'));
        $this->assertNull($reader->socialLink('https://example.com/instagram'));
    }

    public function testReadsTheDeclaredOrganizerOfAnEvent(): void
    {
        $snapshot = (new WebsiteReader())->read(new FetchedWebPage(
            url: 'https://www.eventbrite.ca/e/the-after-123',
            contentType: 'text/html',
            charset: 'utf-8',
            body: '<html><head>
                <script type="application/ld+json">{"@type": "WebPage", "name": "THE AFTER"}</script>
                <script type="application/ld+json">[{"@type": "SocialEvent", "organizer": [{"@type": "Organization", "name": "GLDN &amp; GRVS"}]}]</script>
            </head><body></body></html>',
        ));

        $this->assertSame('GLDN & GRVS', $snapshot->organizerName);
    }

    public function testAPageWithoutAnOrganizerHasNone(): void
    {
        $this->assertNull($this->snapshot()->organizerName);
    }
}
