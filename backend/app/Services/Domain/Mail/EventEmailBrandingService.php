<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Mail;

use Carbon\Carbon;
use HiEvents\DomainObjects\Enums\ImageType;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\ImageDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\OrganizerSettingDomainObject;
use HiEvents\Helper\Url;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO;
use Illuminate\Config\Repository;
use Illuminate\Support\Collection;
use IntlDateFormatter;
use Throwable;

/**
 * The look of the participant emails, taken from the public event page: only the main color
 * follows the organizer (event theme, then « Ma page »), the cream and the dark brown stay.
 */
class EventEmailBrandingService
{
    public const DEHORS_ORANGE = '#fa7853';
    public const DEHORS_CREAM = '#fff7e9';
    public const DEHORS_BROWN = '#352924';
    public const CARD = '#fffcf8';

    public function __construct(
        private readonly Repository               $config,
        private readonly EventRepositoryInterface $eventRepository,
    )
    {
    }

    public function forEvent(EventDomainObject $event, ?OrganizerDomainObject $organizer = null): EventEmailBrandingDTO
    {
        $event = $this->withRelations($event);
        $organizer = $event->getOrganizer() ?? $organizer;
        $settings = $event->getEventSettings();

        $accent = $this->normalizeColor($this->decodeTheme($settings?->getHomepageThemeSettings())['accent'] ?? null)
            ?? $this->normalizeColor($this->decodeTheme($organizer?->getOrganizerSettings()?->getHomepageThemeSettings())['accent'] ?? null)
            ?? self::DEHORS_ORANGE;

        $frontendUrl = rtrim((string)$this->config->get('app.frontend_url'), '/');
        $location = $settings?->getLocationDetails();

        return new EventEmailBrandingDTO(
            accentColor: $accent,
            accentSoftColor: $this->mix($accent, self::DEHORS_CREAM, 0.2),
            accentDeepColor: $this->mix($accent, self::DEHORS_BROWN, 0.65),
            accentTextColor: $this->isDark($accent) ? self::CARD : self::DEHORS_BROWN,
            organizerName: $organizer?->getName() ?: null,
            organizerLogoUrl: $this->findImageUrl($organizer?->getImages(), ImageType::ORGANIZER_LOGO),
            eventTitle: (string)$event->getTitle(),
            eventUrl: $event->getId() ? $event->getEventUrl() : null,
            eventCoverUrl: $this->findImageUrl($event->getImages(), ImageType::EVENT_COVER),
            dateLine: $this->dateLine($event),
            timezoneLine: $this->timezoneLine($event),
            placeLine: $settings?->getIsOnlineEvent() ? __('Online event') : $this->placeLine($location),
            addressLine: $settings?->getIsOnlineEvent() ? null : $this->addressLine($location),
            supportEmail: $settings?->getSupportEmail() ?: $organizer?->getEmail(),
            assetsUrl: $frontendUrl,
            platformLogoUrl: $frontendUrl . '/logos/billetterie-dehors-wordmark.png',
            platformUrl: (string)$this->config->get('app.email_logo_link_url', $frontendUrl),
        );
    }

    private function withRelations(EventDomainObject $event): EventDomainObject
    {
        $organizer = $event->getOrganizer();
        $isComplete = $event->getEventSettings() !== null
            && $event->getImages() !== null
            && $organizer !== null
            && $organizer->getImages() !== null
            && $organizer->getOrganizerSettings() !== null;

        if ($isComplete || !$event->getId()) {
            return $event;
        }

        /** @var EventDomainObject|null $loaded */
        $loaded = $this->eventRepository
            ->loadRelation(EventSettingDomainObject::class)
            ->loadRelation(ImageDomainObject::class)
            ->loadRelation(new Relationship(
                domainObject: OrganizerDomainObject::class,
                nested: [
                    new Relationship(ImageDomainObject::class),
                    new Relationship(OrganizerSettingDomainObject::class),
                ],
                name: 'organizer',
            ))
            ->findFirst($event->getId());

        return $loaded ?? $event;
    }

    /** « Samedi 24 octobre · 07:24 → 10:24 », like the public page. */
    private function dateLine(EventDomainObject $event): ?string
    {
        if (!$event->getStartDate()) {
            return null;
        }

        $timezone = $event->getTimezone() ?: 'UTC';
        $locale = app()->getLocale();
        $start = Carbon::parse($event->getStartDate(), 'UTC')->setTimezone($timezone)->locale($locale);
        $end = $event->getEndDate() ? Carbon::parse($event->getEndDate(), 'UTC')->setTimezone($timezone)->locale($locale) : null;
        $sameYear = $start->year === Carbon::now($timezone)->year;

        if ($end !== null && $start->isSameDay($end)) {
            $day = $start->isoFormat($sameYear ? 'dddd D MMMM' : 'dddd D MMMM YYYY');
            return $this->capitalize(sprintf('%s · %s → %s', $day, $start->isoFormat('LT'), $end->isoFormat('LT')));
        }

        $format = $sameYear ? 'ddd D MMM LT' : 'ddd D MMM YYYY LT';
        $text = $start->isoFormat($format) . ($end !== null ? ' → ' . $end->isoFormat($format) : '');

        return $this->capitalize($text);
    }

    /** « Heure de l'Est (HAE) »: the Canadian names of the time zones. */
    private function timezoneLine(EventDomainObject $event): ?string
    {
        if (!$event->getStartDate() || !$event->getTimezone()) {
            return null;
        }

        try {
            $locale = explode('_', str_replace('-', '_', app()->getLocale()))[0] . '_CA';
            $date = Carbon::parse($event->getStartDate(), 'UTC');
            $name = fn(string $pattern) => (new IntlDateFormatter($locale, IntlDateFormatter::NONE, IntlDateFormatter::NONE, $event->getTimezone(), null, $pattern))
                ->format($date->getTimestamp());

            $long = $name('vvvv');
            $short = $name('zzz');
            if ($long && $short && $long !== $short) {
                return $this->capitalize($long) . " ($short)";
            }

            return $long ?: $short ?: $event->getTimezone();
        } catch (Throwable) {
            return $event->getTimezone();
        }
    }

    private function placeLine(?array $location): ?string
    {
        foreach (['venue_name', 'city'] as $key) {
            if (is_string($location[$key] ?? null) && trim($location[$key]) !== '') {
                return trim($location[$key]);
            }
        }

        return null;
    }

    private function addressLine(?array $location): ?string
    {
        if (!$location) {
            return null;
        }

        $parts = array_filter([
            $location['address_line_1'] ?? null,
            $location['city'] ?? null,
            $location['state_or_region'] ?? null,
        ], fn($part) => is_string($part) && trim($part) !== '');

        $line = implode(', ', $parts);

        return $line !== '' && $line !== ($location['venue_name'] ?? null) ? $line : null;
    }

    private function decodeTheme(array|string|null $theme): array
    {
        if (is_string($theme)) {
            $theme = json_decode($theme, true);
        }

        return is_array($theme) ? $theme : [];
    }

    private function normalizeColor(mixed $color): ?string
    {
        if (!is_string($color) || !preg_match('/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i', $color)) {
            return null;
        }

        $hex = substr($color, 1);

        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }

        return '#' . strtolower(substr($hex, 0, 6));
    }

    /** Like color-mix(in srgb, $color $weight, $base) on the public page. */
    private function mix(string $color, string $base, float $weight): string
    {
        $a = sscanf($color, '#%02x%02x%02x');
        $b = sscanf($base, '#%02x%02x%02x');

        return vsprintf('#%02x%02x%02x', array_map(
            fn(int $i) => (int)round($a[$i] * $weight + $b[$i] * (1 - $weight)),
            [0, 1, 2],
        ));
    }

    private function isDark(string $hexColor): bool
    {
        [$r, $g, $b] = sscanf($hexColor, '#%02x%02x%02x');

        return (0.299 * $r + 0.587 * $g + 0.114 * $b) < 150;
    }

    private function capitalize(string $text): string
    {
        return mb_strtoupper(mb_substr($text, 0, 1)) . mb_substr($text, 1);
    }

    private function findImageUrl(?Collection $images, ImageType $type): ?string
    {
        /** @var ImageDomainObject|null $image */
        $image = $images?->first(fn(ImageDomainObject $image) => $image->getType() === $type->name);

        return $image ? Url::getCdnUrl($image->getPath()) : null;
    }
}
