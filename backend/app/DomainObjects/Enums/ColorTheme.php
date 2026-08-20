<?php

namespace HiEvents\DomainObjects\Enums;

enum ColorTheme: string
{
    /**
     * Thème maison DEHORS. Sert de défaut à toute nouvelle organisation
     * (cf. config/app.php), qui reste libre de le remplacer depuis le
     * concepteur de page d'accueil — c'est tout l'intérêt d'un défaut.
     */
    case DEHORS = 'Dehors';
    case CLASSIC = 'Classic';
    case ELEGANT = 'Elegant';
    case MODERN = 'Modern';
    case OCEAN = 'Ocean';
    case FOREST = 'Forest';
    case SUNSET = 'Sunset';
    case MIDNIGHT = 'Midnight';
    case ROYAL = 'Royal';
    case CORAL = 'Coral';
    case ARCTIC = 'Arctic';
    case NOIR = 'Noir';

    public function getThemeData(): array
    {
        return match ($this) {
            self::DEHORS => [
                'name' => self::DEHORS->value,
                'homepage_background_color' => '#f9f3e1',
                'homepage_content_background_color' => '#fdfaf0bf',
                /*
                 * #ae5626 et non l'orange de marque #ef854a. L'accent sert ICI
                 * de couleur de TEXTE autant que d'aplat (cf. le bandeau de
                 * consentement, qui l'emploie en `color:` comme en
                 * `background:`), et #ef854a ne donne que 3,1:1 sur le beige —
                 * sous le 4,5:1 du WCAG AA. C'est la règle que la charte DEHORS
                 * pose déjà noir sur blanc: l'orange foncé pour les fonds,
                 * l'orange texte dès que ce sont des lettres.
                 */
                'homepage_primary_color' => '#ae5626',
                'homepage_primary_text_color' => '#241c15',
                'homepage_secondary_color' => '#2a805a',
                'homepage_secondary_text_color' => '#fdfaf0',
            ],
            self::MIDNIGHT => [
                'name' => self::MIDNIGHT->value,
                'homepage_background_color' => '#737373ff',
                'homepage_content_background_color' => '#0f172a9c',
                'homepage_primary_color' => '#ffffffff',
                'homepage_primary_text_color' => '#ffffffff',
                'homepage_secondary_color' => '#b3b3b3ff',
                'homepage_secondary_text_color' => '#ffffff',
            ],
            self::CLASSIC => [
                'name' => self::CLASSIC->value,
                'homepage_background_color' => '#fafafa',
                'homepage_content_background_color' => '#ffffffbf',
                'homepage_primary_color' => '#171717',
                'homepage_primary_text_color' => '#171717',
                'homepage_secondary_color' => '#737373',
                'homepage_secondary_text_color' => '#ffffff',
            ],
            self::ELEGANT => [
                'name' => self::ELEGANT->value,
                'homepage_background_color' => '#1a1523',
                'homepage_content_background_color' => '#2d2438bf',
                'homepage_primary_color' => '#d4af37',
                'homepage_primary_text_color' => '#f5e6d3',
                'homepage_secondary_color' => '#b8860b',
                'homepage_secondary_text_color' => '#faf0e6',
            ],
            self::MODERN => [
                'name' => self::MODERN->value,
                'homepage_background_color' => '#2c0838',
                'homepage_content_background_color' => '#32174fbf',
                'homepage_primary_color' => '#c7a2db',
                'homepage_primary_text_color' => '#ffffff',
                'homepage_secondary_color' => '#c7a2db',
                'homepage_secondary_text_color' => '#ffffff',
            ],
            self::OCEAN => [
                'name' => self::OCEAN->value,
                'homepage_background_color' => '#c3e3f7',
                'homepage_content_background_color' => '#ffffffbf',
                'homepage_primary_color' => '#0ea5e9',
                'homepage_primary_text_color' => '#075985',
                'homepage_secondary_color' => '#0891b2',
                'homepage_secondary_text_color' => '#e9f6ff',
            ],
            self::FOREST => [
                'name' => self::FOREST->value,
                'homepage_background_color' => '#91b89e',
                'homepage_content_background_color' => '#ffffffbf',
                'homepage_primary_color' => '#91b89e',
                'homepage_primary_text_color' => '#14532d',
                'homepage_secondary_color' => '#16a34a',
                'homepage_secondary_text_color' => '#eefff3',
            ],
            self::SUNSET => [
                'name' => self::SUNSET->value,
                'homepage_background_color' => '#e8c47b',
                'homepage_content_background_color' => '#ffffffbf',
                'homepage_primary_color' => '#f97316',
                'homepage_primary_text_color' => '#7c2d12',
                'homepage_secondary_color' => '#ea580c',
                'homepage_secondary_text_color' => '#fad9cd',
            ],
            self::ROYAL => [
                'name' => self::ROYAL->value,
                'homepage_background_color' => '#f3e8ff',
                'homepage_content_background_color' => '#ffffffbf',
                'homepage_primary_color' => '#a855f7',
                'homepage_primary_text_color' => '#581c87',
                'homepage_secondary_color' => '#9333ea',
                'homepage_secondary_text_color' => '#f6eeff',
            ],
            self::CORAL => [
                'name' => self::CORAL->value,
                'homepage_background_color' => '#ffe4e6',
                'homepage_content_background_color' => '#ffffffbf',
                'homepage_primary_color' => '#f87171',
                'homepage_primary_text_color' => '#991b1b',
                'homepage_secondary_color' => '#ef4444',
                'homepage_secondary_text_color' => '#ffd4d4',
            ],
            self::ARCTIC => [
                'name' => self::ARCTIC->value,
                'homepage_background_color' => '#71bdad',
                'homepage_content_background_color' => '#ffffffbf',
                'homepage_primary_color' => '#14b8a6',
                'homepage_primary_text_color' => '#134e4a',
                'homepage_secondary_color' => '#0d9488',
                'homepage_secondary_text_color' => '#ffffff',
            ],
            self::NOIR => [
                'name' => self::NOIR->value,
                'homepage_background_color' => '#09090b',
                'homepage_content_background_color' => '#18181bbf',
                'homepage_primary_color' => '#f87171',
                'homepage_primary_text_color' => '#fafafa',
                'homepage_secondary_color' => '#f87172ff',
                'homepage_secondary_text_color' => '#ffffff',
            ],
        };
    }

    /**
     * Le format que le front lit VRAIMENT (`HomepageThemeSettings`):
     * accent + fond + clair/sombre. `getThemeData()` rend encore l'ancien
     * format à six couleurs, qu'une migration d'upstream convertit une fois
     * pour toutes — mais rien ne convertit les organisations créées APRÈS.
     * On dérive donc ici, avec la même règle de luminance que cette migration.
     */
    public function getHomepageThemeSettings(): array
    {
        $data = $this->getThemeData();

        return [
            'accent' => $data['homepage_primary_color'],
            'background' => $data['homepage_background_color'],
            'mode' => self::detectMode($data['homepage_background_color']),
            'background_type' => 'COLOR',
            'font_family' => $this === self::DEHORS ? 'Archivo' : 'Outfit',
        ];
    }

    /** Fond clair ou sombre, par la luminance WCAG. */
    private static function detectMode(string $backgroundColor): string
    {
        $hex = ltrim($backgroundColor, '#');

        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        } elseif (strlen($hex) === 8) {
            $hex = substr($hex, 0, 6);
        }

        if (strlen($hex) !== 6) {
            return 'light';
        }

        $luminance = 0.2126 * hexdec(substr($hex, 0, 2))
            + 0.7152 * hexdec(substr($hex, 2, 2))
            + 0.0722 * hexdec(substr($hex, 4, 2));

        return $luminance > 128 ? 'light' : 'dark';
    }

    public static function getAllThemes(): array
    {
        return array_map(
            static fn(self $theme) => $theme->getThemeData(),
            self::cases()
        );
    }
}
