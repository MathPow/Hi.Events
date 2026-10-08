<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Mail;

use HiEvents\DomainObjects\Enums\ImageType;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\ImageDomainObject;
use HiEvents\Helper\Url;
use HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO;
use Illuminate\Config\Repository;
use Illuminate\Support\Collection;

class EventEmailBrandingService
{
    private const DEFAULT_ACCENT_COLOR = '#1f1a33';
    private const DEFAULT_BACKGROUND_COLOR = '#f6f3ee';
    private const FALLBACK_FONT_STACK = "'Helvetica Neue', Helvetica, Arial, sans-serif";

    public function __construct(
        private readonly Repository $config,
    )
    {
    }

    public function forEvent(EventDomainObject $event): EventEmailBrandingDTO
    {
        $organizer = $event->getOrganizer();
        $eventTheme = $this->decodeTheme($event->getEventSettings()?->getHomepageThemeSettings());
        $organizerTheme = $this->decodeTheme($organizer?->getOrganizerSettings()?->getHomepageThemeSettings());

        $accentColor = $this->normalizeColor($eventTheme['accent'] ?? null)
            ?? $this->normalizeColor($organizerTheme['accent'] ?? null)
            ?? self::DEFAULT_ACCENT_COLOR;

        $backgroundColor = $this->normalizeColor($eventTheme['background'] ?? null)
            ?? $this->normalizeColor($organizerTheme['background'] ?? null)
            ?? self::DEFAULT_BACKGROUND_COLOR;

        $font = $eventTheme['font_family'] ?? $organizerTheme['font_family'] ?? null;
        $font = is_string($font) && preg_match('/^[A-Za-z0-9 ]{1,50}$/', $font) ? $font : null;

        $frontendUrl = rtrim((string)$this->config->get('app.frontend_url'), '/');

        return new EventEmailBrandingDTO(
            accentColor: $accentColor,
            accentTextColor: $this->isDark($accentColor) ? '#ffffff' : '#1f1a33',
            backgroundColor: $backgroundColor,
            fontFamily: $font ? "'{$font}', " . self::FALLBACK_FONT_STACK : self::FALLBACK_FONT_STACK,
            fontStylesheetUrl: $font
                ? 'https://fonts.googleapis.com/css2?family=' . str_replace(' ', '+', $font) . ':wght@400;600;700&display=swap'
                : null,
            organizerName: $organizer?->getName(),
            organizerLogoUrl: $this->findImageUrl($organizer?->getImages(), ImageType::ORGANIZER_LOGO),
            eventCoverUrl: $this->findImageUrl($event->getImages(), ImageType::EVENT_COVER),
            platformLogoUrl: $frontendUrl . '/logos/dehors-billetterie-clair.png',
            platformUrl: (string)$this->config->get('app.email_logo_link_url', $frontendUrl),
        );
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

    private function isDark(string $hexColor): bool
    {
        [$r, $g, $b] = sscanf($hexColor, '#%02x%02x%02x');

        return (0.299 * $r + 0.587 * $g + 0.114 * $b) < 150;
    }

    private function findImageUrl(?Collection $images, ImageType $type): ?string
    {
        /** @var ImageDomainObject|null $image */
        $image = $images?->first(fn(ImageDomainObject $image) => $image->getType() === $type->name);

        return $image ? Url::getCdnUrl($image->getPath()) : null;
    }
}
