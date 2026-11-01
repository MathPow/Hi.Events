import {t} from "@lingui/macro";
import {IconLink} from "@tabler/icons-react";
import {socialMediaConfig} from "../../../../constants/socialMediaConfig.ts";

// The networks offered by « Ajouter un réseau », in the order of the Settings page (Strava for the clubs).
export const SOCIAL_PLATFORMS = [
    'instagram', 'facebook', 'strava', 'tiktok', 'youtube', 'twitter', 'linkedin', 'discord', 'snapchat',
    'twitch', 'reddit', 'pinterest', 'whatsapp', 'telegram', 'github', 'vimeo', 'vk', 'weibo',
] as const;

export const socialPlatformLabel = (platform: string): string => {
    const labels: Record<string, string> = {
        facebook: t`Facebook`,
        instagram: t`Instagram`,
        twitter: t`X (Twitter)`,
        linkedin: t`LinkedIn`,
        youtube: t`YouTube`,
        tiktok: t`TikTok`,
        strava: t`Strava`,
        discord: t`Discord`,
        snapchat: t`Snapchat`,
        twitch: t`Twitch`,
        reddit: t`Reddit`,
        pinterest: t`Pinterest`,
        whatsapp: t`WhatsApp`,
        telegram: t`Telegram`,
        github: t`GitHub`,
        vimeo: t`Vimeo`,
        vk: t`VK`,
        weibo: t`Weibo`,
    };
    return labels[platform] ?? platform.charAt(0).toUpperCase() + platform.slice(1);
};

export const socialPlatformIcon = (platform: string) =>
    socialMediaConfig[platform as keyof typeof socialMediaConfig]?.icon ?? IconLink;

// « instagram.com/dehorsqc »: where the link of the public page leads.
export const socialPlatformLink = (platform: string, handle: string) => {
    const baseUrl = socialMediaConfig[platform as keyof typeof socialMediaConfig]?.baseUrl;
    if (!baseUrl || baseUrl === '#') {
        return null;
    }
    return (baseUrl + handle.trim().replace(/^@/, '')).replace(/^https?:\/\/(www\.)?/, '');
};
