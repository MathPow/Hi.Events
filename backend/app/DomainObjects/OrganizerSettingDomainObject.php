<?php

namespace HiEvents\DomainObjects;

use BackedEnum;
use UnitEnum;

class OrganizerSettingDomainObject extends Generated\OrganizerSettingDomainObjectAbstract
{
    public const SOCIAL_MEDIA_PLATFORMS = [
        'facebook', 'instagram', 'twitter', 'linkedin', 'discord', 'tiktok', 'youtube', 'snapchat',
        'twitch', 'reddit', 'pinterest', 'whatsapp', 'telegram', 'vk', 'weibo', 'wechat', 'flickr',
        'tumblr', 'quora', 'vimeo', 'github', 'strava',
    ];

    public function getSocialMediaHandle(string $platform): ?string
    {
        $handles = $this->getSocialMediaHandles();

        return $handles[$platform] ?? null;
    }

    /**
     * The handles shown on the public pages: in the order chosen by the organizer, without the hidden ones.
     * Handles missing from the layout (added since) follow, in their stored order.
     */
    public function getVisibleSocialMediaHandles(): array
    {
        $handles = array_filter((array) ($this->getSocialMediaHandles() ?? []));
        $layout = (array) ($this->getSocialMediaLayout() ?? []);

        $ordered = [];
        foreach ($layout as $entry) {
            $platform = $entry['platform'] ?? null;
            if (! is_string($platform) || ! isset($handles[$platform]) || array_key_exists($platform, $ordered)) {
                continue;
            }
            $ordered[$platform] = ($entry['visible'] ?? true) ? $handles[$platform] : null;
        }

        return array_filter($ordered + $handles);
    }

    public function getHomepageThemeSetting(string $key, string $default = ''): ?string
    {
        $settings = $this->getHomepageThemeSettings();

        if (isset($settings[$key]) && ($settings[$key] instanceof UnitEnum)) {
            return $settings[$key] instanceof BackedEnum
                ? $settings[$key]->value
                : $settings[$key]->name;
        }

        return $settings[$key] ?? $default;
    }
}
