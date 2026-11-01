import {t} from "@lingui/macro";
import {i18n} from "@lingui/core";
import {
    IconBottle,
    IconFlag,
    IconHeartHandshake,
    IconKey,
    IconMapPins,
    IconSeedling,
    IconTrophy,
    Icon,
} from "@tabler/icons-react";
import {OrganizerAchievementKey, OrganizerAchievementProgress} from "../../../types.ts";

export interface AchievementDefinition {
    // The badge shows either an icon or a short text (the number of a « Club des 100 »).
    icon?: Icon;
    label?: string;
    // Figma « Admin · Succès »: the solid background of its card, and the disc of the badge
    background: string;
    badge: string;
    // The card of the Succès page when it is a dark colour (cream text); else `background`.
    card?: string;
    title: string;
    description: string;
}

// In the page's language, « 1 000 » in French
const numberLocale = () => i18n.locale?.startsWith('fr') ? 'fr-CA' : (i18n.locale || 'fr-CA');

const COLORS = {
    green: {background: '#b9d7a8', badge: '#6e9e5a'},
    teal: {background: '#8fd3c1', badge: '#3e9c85'},
    yellow: {background: '#f6c85f', badge: '#c4911e'},
    orange: {background: '#f9a66c', badge: '#c9662a'},
    pink: {background: '#f4a7b9', badge: '#c9627d'},
    purple: {background: '#c5b4e3', badge: '#8268b5'},
    blue: {background: '#9cc9e3', badge: '#4e8db3'},
    terracotta: {background: '#d98c7a', badge: '#a24e3b'},
    periwinkle: {background: '#a7b8f4', badge: '#5a6fc2'},
    sand: {background: '#e3c08f', badge: '#a9803e'},
};

// The dark cards of the collection (Figma « Admin · Succès »: pale and dark colours, all around
// the wheel); their badge and the other places keep the pale colour.
const DARK = {
    blue: '#2f5d7c',
    pink: '#b5546f',
    green: '#3e7f6e',
    purple: '#5b4a8a',
};

// « Club des 100 » to « Club des 69420 »: the same measure, a bigger crowd each time.
const club = (count: string, colors: { background: string, badge: string }): AchievementDefinition => ({
    label: count,
    ...colors,
    title: t`${count} Club`,
    description: t`Reach ${count} registered participants.`,
});

/**
 * Icon, colours and texts of the achievements. The server decides what is earned.
 * Kept in sync with backend/app/DomainObjects/Enums/OrganizerAchievement.php.
 */
export const achievementDefinition = (key: OrganizerAchievementKey): AchievementDefinition => {
    switch (key) {
        case 'first_event':
            return {
                icon: IconFlag, ...COLORS.green,
                title: t`Starting Line`,
                description: t`Create your first event.`,
            };
        case 'first_merchandise_sale':
            return {
                icon: IconBottle, ...COLORS.teal, card: DARK.green,
                title: t`Aid Station`,
                description: t`Sell an item other than a ticket.`,
            };
        case 'hundred_attendees':
            return club('100', COLORS.yellow);
        case 'attendees_250':
            return club('250', COLORS.orange);
        case 'attendees_500':
            return {...club('500', COLORS.pink), card: DARK.pink};
        case 'attendees_1000':
            return club('1000', COLORS.purple);
        case 'attendees_5000':
            return {...club('5000', COLORS.blue), card: DARK.blue};
        case 'attendees_69420':
            return club('69420', COLORS.terracotta);
        case 'returning_attendees':
            return {
                icon: IconHeartHandshake, ...COLORS.periwinkle,
                title: t`Comeback Club`,
                description: t`Bring 25 participants back to another one of your events.`,
            };
        case 'hat_trick':
            return {
                icon: IconTrophy, ...COLORS.sand,
                title: t`Hat Trick`,
                description: t`Hold 3 events with participants.`,
            };
        case 'promo_code_uses':
            return {
                icon: IconKey, ...COLORS.purple, card: DARK.purple,
                title: t`Secret Code`,
                description: t`Have your participants use 10 promo codes.`,
            };
        case 'quebec_tour':
            return {
                icon: IconMapPins, ...COLORS.green,
                title: t`Tour of Québec`,
                description: t`Hold events in 3 different regions.`,
            };
        case 'first_time_attendees':
            return {
                icon: IconSeedling, ...COLORS.pink,
                title: t`Rookie`,
                description: t`Welcome 50 participants registering on the platform for the very first time.`,
            };
    }
};

/**
 * "40 / 100". Null when there is a single step.
 */
export const progressLabel = (achievement: OrganizerAchievementProgress): string | null => {
    if (achievement.target <= 1) {
        return null;
    }

    const format = (value: number) => new Intl.NumberFormat(numberLocale()).format(value);

    return `${format(Math.min(achievement.current, achievement.target))} / ${format(achievement.target)}`;
};

/**
 * The achievement closest to being earned, as a share of its target; the first one shown wins a tie.
 */
export const nextAchievement = (achievements: OrganizerAchievementProgress[]): OrganizerAchievementProgress | undefined => {
    return achievements
        .filter((achievement) => !achievement.earned_at)
        .reduce<OrganizerAchievementProgress | undefined>((best, achievement) => {
            const share = achievement.current / achievement.target;
            return best === undefined || share > best.current / best.target ? achievement : best;
        }, undefined);
};
