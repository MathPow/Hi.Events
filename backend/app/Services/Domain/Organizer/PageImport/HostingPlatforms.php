<?php

namespace HiEvents\Services\Domain\Organizer\PageImport;

/**
 * Les billetteries et les reseaux qui hebergent la page d'un organisateur : le
 * logo, la couleur, le nom du site et les comptes qu'on y lit sont les leurs,
 * pas les siens. Instagram n'y est pas : il a son propre traitement.
 */
class HostingPlatforms
{
    /** Le nom de la plateforme => ses domaines ; « eventbrite.* » vaut pour tous ses pays. */
    private const PLATFORMS = [
        'Eventbrite' => ['eventbrite.*'],
        'Lepointdevente' => ['lepointdevente.com'],
        'Zeffy' => ['zeffy.com'],
        'Ticketmaster' => ['ticketmaster.*'],
        'evenko' => ['evenko.ca'],
        'Admit One' => ['admitone.com'],
        'Showpass' => ['showpass.com'],
        'Universe' => ['universe.com'],
        'Ticket Tailor' => ['tickettailor.com', 'buytickets.at'],
        'Humanitix' => ['humanitix.com'],
        'Weezevent' => ['weezevent.com'],
        'Billetweb' => ['billetweb.fr'],
        'Ticketpro' => ['ticketpro.ca'],
        'Luma' => ['lu.ma', 'luma.com'],
        'Race Roster' => ['raceroster.com'],
        'RunSignup' => ['runsignup.com'],
        'UltraSignup' => ['ultrasignup.com'],
        'Trackie' => ['trackie.com'],
        'Zone4' => ['zone4.ca'],
        'Sportstats' => ['sportstats.one', 'sportstats.ca'],
        'Webscorer' => ['webscorer.com'],
        'Amilia' => ['amilia.com'],
        'Qidigo' => ['qidigo.com'],
        'HelloAsso' => ['helloasso.com'],
        'Yapla' => ['yapla.com'],
        'Facebook' => ['facebook.com', 'fb.com'],
        'TikTok' => ['tiktok.com'],
        'X' => ['x.com', 'twitter.com'],
        'LinkedIn' => ['linkedin.com'],
        'YouTube' => ['youtube.com'],
        'Linktree' => ['linktr.ee'],
    ];

    /** L'image de partage par defaut de la plateforme, pas celle d'un evenement. */
    private const GENERIC_IMAGE = '#(^|[/_.\-])(logos?|ogp|og-image|default|placeholder|share)([/_.\-]|$)#i';

    public function of(string $url): ?string
    {
        $host = $this->host($url);

        foreach (self::PLATFORMS as $platform => $domains) {
            foreach ($domains as $domain) {
                if (preg_match('#(^|\.)' . $this->pattern($domain) . '$#', $host)) {
                    return $platform;
                }
            }
        }

        return null;
    }

    /** « eventbrite.ca » est la plateforme ; « club.lepointdevente.com » est deja une page d'organisateur. */
    public function isHomePage(string $url): bool
    {
        if (trim((string)parse_url($url, PHP_URL_PATH), '/') !== '') {
            return false;
        }

        $host = preg_replace('/^www\./', '', $this->host($url));
        foreach (self::PLATFORMS as $domains) {
            foreach ($domains as $domain) {
                if (preg_match('#^' . $this->pattern($domain) . '$#', $host)) {
                    return true;
                }
            }
        }

        return false;
    }

    /** Un compte ou un nom qui est celui de la plateforme : @eventbritehelp, lepointdevente-com, « … - Lepointdevente.com ». */
    public function isNamedAfter(string $platform, string $text): bool
    {
        $name = strtolower(preg_replace('/[^a-z0-9]/i', '', $platform));
        $text = strtolower($text);

        return strlen($name) < 3 ? $text === $name : str_contains(preg_replace('/[^a-z0-9]/', '', $text), $name);
    }

    public function isGenericImage(string $imageUrl): bool
    {
        return (bool)preg_match(self::GENERIC_IMAGE, (string)parse_url($imageUrl, PHP_URL_PATH));
    }

    private function host(string $url): string
    {
        return strtolower((string)parse_url($url, PHP_URL_HOST));
    }

    private function pattern(string $domain): string
    {
        return str_replace('\*', '[a-z.]+', preg_quote($domain, '#'));
    }
}
