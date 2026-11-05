<?php

namespace HiEvents\Services\Domain\Organizer\PageImport;

use DOMDocument;
use DOMElement;
use DOMXPath;
use GuzzleHttp\Psr7\UriResolver;
use GuzzleHttp\Psr7\Utils;
use HiEvents\Services\Infrastructure\WebPage\FetchedWebPage;

/**
 * Ce qu'une page web dit de son organisateur : noms, descriptions, couleur,
 * images candidates pour le logo et la couverture, reseaux sociaux et texte.
 * Rien n'est execute ni charge : le HTML est seulement lu.
 */
class WebsiteReader
{
    private const MAX_TEXT = 6000;

    /** Hote => [reseau de « Ma page », motif du nom dans le chemin]. */
    private const SOCIAL_PATTERNS = [
        'instagram.com' => ['instagram', '#^/([A-Za-z0-9._]{1,30})/?$#'],
        'facebook.com' => ['facebook', '#^/((?:groups/)?[A-Za-z0-9.\-]{2,80}|profile\.php\?id=\d+)/?$#'],
        'fb.com' => ['facebook', '#^/([A-Za-z0-9.\-]{2,80})/?$#'],
        'tiktok.com' => ['tiktok', '#^/@([A-Za-z0-9._]{2,24})/?$#'],
        'youtube.com' => ['youtube', '#^/@([A-Za-z0-9._\-]{3,30})/?$#'],
        'x.com' => ['twitter', '#^/([A-Za-z0-9_]{1,15})/?$#'],
        'twitter.com' => ['twitter', '#^/([A-Za-z0-9_]{1,15})/?$#'],
        'linkedin.com' => ['linkedin', '#^/company/([A-Za-z0-9\-_%]{2,100})/?$#'],
        'strava.com' => ['strava', '#^/clubs/([A-Za-z0-9\-_]{1,100})/?$#'],
        'pinterest.com' => ['pinterest', '#^/([A-Za-z0-9_]{3,30})/?$#'],
        'twitch.tv' => ['twitch', '#^/([A-Za-z0-9_]{3,25})/?$#'],
        'vimeo.com' => ['vimeo', '#^/([A-Za-z0-9_]{2,40})/?$#'],
        't.me' => ['telegram', '#^/([A-Za-z0-9_]{4,40})/?$#'],
        'wa.me' => ['whatsapp', '#^/(\d{6,16})/?$#'],
        'snapchat.com' => ['snapchat', '#^/add/([A-Za-z0-9._\-]{3,15})/?$#'],
        'reddit.com' => ['reddit', '#^/(?:u|user)/([A-Za-z0-9_\-]{3,20})/?$#'],
    ];

    /** Des chemins qui ressemblent a un nom mais n'en sont pas. */
    private const NOT_HANDLES = [
        'p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'sharer', 'sharer.php', 'share', 'dialog',
        'plugins', 'tr', 'intent', 'home', 'hashtag', 'i', 'search', 'login', 'watch', 'embed', 'pin',
        'policies', 'privacy', 'legal', 'about', 'help', 'events', 'pages', 'tos',
    ];

    /** @param (callable(string): bool)|null $skipHandle les comptes a ignorer : un seul est garde par reseau, ils cacheraient les bons */
    public function read(FetchedWebPage $page, ?callable $skipHandle = null): WebsiteSnapshot
    {
        $dom = new DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="UTF-8">' . $this->toUtf8($page), LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        $xpath = new DOMXPath($dom);
        $base = $this->baseUrl($xpath, $page->url);

        $meta = fn(string $key) => $this->meta($xpath, $key);

        return new WebsiteSnapshot(
            url: $page->url,
            names: $this->unique([
                $meta('og:site_name'),
                $meta('application-name'),
                $meta('og:title'),
                $this->text($xpath->query('//title')->item(0)),
            ]),
            descriptions: $this->unique([$meta('description'), $meta('og:description'), $meta('twitter:description')]),
            themeColor: $this->hexColor($meta('theme-color') ?? $meta('msapplication-TileColor')),
            logoCandidates: $this->unique(array_map(fn($src) => $this->absolute($base, $src), $this->logoSources($xpath))),
            coverCandidates: $this->unique(array_map(fn($src) => $this->absolute($base, $src), [
                $meta('og:image:secure_url'), $meta('og:image'), $meta('twitter:image'), $meta('twitter:image:src'),
            ])),
            socialLinks: $this->socialLinks($xpath, $base, $skipHandle),
            organizerName: $this->declaredOrganizer($xpath),
            text: $this->visibleText($dom, $xpath),
        );
    }

    /** « instagram.com/dehorsqc » => ['instagram', 'dehorsqc'], sinon null. */
    public function socialLink(string $url): ?array
    {
        $parts = parse_url($url);
        $host = strtolower($parts['host'] ?? '');
        // www.instagram.com, m.facebook.com, ca.linkedin.com, fr-fr.facebook.com ; mais wa.me reste wa.me.
        if (preg_match('/^(?:www|m|mobile|[a-z]{2}(?:-[a-z]{2})?)\.(.+\..+)$/', $host, $match)) {
            $host = $match[1];
        }
        if (!isset(self::SOCIAL_PATTERNS[$host])) {
            return null;
        }

        [$platform, $pattern] = self::SOCIAL_PATTERNS[$host];
        $path = ($parts['path'] ?? '/') . (isset($parts['query']) && str_starts_with($parts['query'], 'id=') ? '?' . $parts['query'] : '');
        if (!preg_match($pattern, $path, $match) || in_array(strtolower($match[1]), self::NOT_HANDLES, true)) {
            return null;
        }

        return [$platform, $match[1]];
    }

    private function toUtf8(FetchedWebPage $page): string
    {
        $html = $page->body;
        $charset = $page->charset;
        if ($charset === null && preg_match('/<meta[^>]+charset=["\']?([\w-]+)/i', substr($html, 0, 4096), $match)) {
            $charset = strtolower($match[1]);
        }
        if ($charset !== null && !in_array($charset, ['utf-8', 'utf8'], true)) {
            $converted = @mb_convert_encoding($html, 'UTF-8', $charset);
            $html = $converted !== false ? $converted : $html;
        }

        return mb_scrub($html, 'UTF-8');
    }

    private function meta(DOMXPath $xpath, string $key): ?string
    {
        $key = strtolower($key);
        foreach ($xpath->query('//meta[@content]') as $node) {
            /** @var DOMElement $node */
            $name = strtolower($node->getAttribute('property') ?: $node->getAttribute('name'));
            if ($name === $key) {
                $value = trim(html_entity_decode($node->getAttribute('content'), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
                return $value !== '' ? $value : null;
            }
        }

        return null;
    }

    /** Le « organizer » des donnees structurees d'une page d'evenement. */
    private function declaredOrganizer(DOMXPath $xpath): ?string
    {
        foreach ($xpath->query('//script[@type="application/ld+json"]') as $script) {
            $data = json_decode($script->textContent, true);
            $name = is_array($data) ? $this->organizerIn($data) : null;
            if ($name !== null) {
                return $name;
            }
        }

        return null;
    }

    private function organizerIn(array $data): ?string
    {
        $organizer = $data['organizer'] ?? null;
        $organizer = is_array($organizer) && array_is_list($organizer) ? ($organizer[0] ?? null) : $organizer;
        if (is_array($organizer) && is_string($organizer['name'] ?? null) && trim($organizer['name']) !== '') {
            return trim(html_entity_decode($organizer['name'], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        }

        foreach ($data as $value) {
            $name = is_array($value) ? $this->organizerIn($value) : null;
            if ($name !== null) {
                return $name;
            }
        }

        return null;
    }

    /** @return list<string|null> le logo declare d'abord, puis les images nommees « logo », puis les icones */
    private function logoSources(DOMXPath $xpath): array
    {
        $sources = [];

        foreach ($xpath->query('//script[@type="application/ld+json"]') as $script) {
            $data = json_decode($script->textContent, true);
            if (!is_array($data)) {
                continue;
            }
            array_walk_recursive($data, function ($value, $key) use (&$sources) {
                if ($key === 'logo' && is_string($value)) {
                    $sources[] = $value;
                }
            });
            $logo = $data['logo']['url'] ?? $data['publisher']['logo']['url'] ?? null;
            if (is_string($logo)) {
                $sources[] = $logo;
            }
        }

        $logoImages = $xpath->query('//img[contains(translate(concat(@class," ",@id," ",@alt," ",@src)," ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"logo")]');
        foreach ($logoImages as $image) {
            /** @var DOMElement $image */
            $sources[] = $this->bestSrc($image);
        }

        $icons = [];
        foreach ($xpath->query('//link[@href and contains(@rel, "icon")]') as $link) {
            /** @var DOMElement $link */
            $size = (int)explode('x', strtolower($link->getAttribute('sizes')) . 'x')[0];
            $isApple = str_contains($link->getAttribute('rel'), 'apple-touch-icon');
            $icons[] = ['src' => $link->getAttribute('href'), 'size' => $isApple ? max($size, 180) : $size];
        }
        usort($icons, fn($a, $b) => $b['size'] <=> $a['size']);

        return [...$sources, ...array_column($icons, 'src')];
    }

    /** La plus grande image d'un srcset, sinon src. */
    private function bestSrc(DOMElement $image): ?string
    {
        $best = null;
        $bestWidth = 0;
        foreach (explode(',', $image->getAttribute('srcset')) as $candidate) {
            $pieces = preg_split('/\s+/', trim($candidate));
            $width = (int)($pieces[1] ?? 0);
            if (($pieces[0] ?? '') !== '' && $width >= $bestWidth) {
                [$best, $bestWidth] = [$pieces[0], $width];
            }
        }

        return $best ?? ($image->getAttribute('src') ?: $image->getAttribute('data-src') ?: null);
    }

    /** @return list<array{platform: string, handle: string}> un compte par reseau, dans l'ordre de la page */
    private function socialLinks(DOMXPath $xpath, string $base, ?callable $skipHandle): array
    {
        $links = [];
        foreach ($xpath->query('//a[@href]') as $anchor) {
            /** @var DOMElement $anchor */
            $found = $this->socialLink($this->absolute($base, $anchor->getAttribute('href')) ?? '');
            if ($found !== null && !isset($links[$found[0]]) && !($skipHandle !== null && $skipHandle($found[1]))) {
                $links[$found[0]] = ['platform' => $found[0], 'handle' => $found[1]];
            }
        }

        return array_values($links);
    }

    private function visibleText(DOMDocument $dom, DOMXPath $xpath): string
    {
        foreach (iterator_to_array($xpath->query('//script|//style|//noscript|//svg|//template|//iframe')) as $node) {
            $node->parentNode?->removeChild($node);
        }

        $body = $dom->getElementsByTagName('body')->item(0);
        $text = preg_replace('/\s+/u', ' ', $body?->textContent ?? '');

        return mb_substr(trim($text), 0, self::MAX_TEXT);
    }

    private function baseUrl(DOMXPath $xpath, string $pageUrl): string
    {
        $base = $xpath->query('//base[@href]')->item(0);

        return $base instanceof DOMElement ? ($this->absolute($pageUrl, $base->getAttribute('href')) ?? $pageUrl) : $pageUrl;
    }

    private function absolute(string $base, ?string $href): ?string
    {
        $href = trim((string)$href);
        if ($href === '' || preg_match('#^(data|javascript|mailto|tel):#i', $href)) {
            return null;
        }

        $url = (string)UriResolver::resolve(Utils::uriFor($base), Utils::uriFor($href));

        return preg_match('#^https?://#i', $url) ? $url : null;
    }

    private function text(mixed $node): ?string
    {
        $text = $node !== null ? trim(preg_replace('/\s+/u', ' ', $node->textContent)) : '';

        return $text !== '' ? $text : null;
    }

    /** « #fa7853 », « #FA7853 », « #f75 » => « #FA7853 » ; le reste (rgb(), noms) est ignore. */
    private function hexColor(?string $value): ?string
    {
        $value = trim((string)$value);
        if (preg_match('/^#([0-9a-f]{6})$/i', $value, $match)) {
            return '#' . strtoupper($match[1]);
        }
        if (preg_match('/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i', $value, $match)) {
            return strtoupper("#{$match[1]}{$match[1]}{$match[2]}{$match[2]}{$match[3]}{$match[3]}");
        }

        return null;
    }

    /** @param array<string|null> $values @return list<string> */
    private function unique(array $values): array
    {
        return array_values(array_unique(array_filter($values, fn($value) => $value !== null && $value !== '')));
    }
}
