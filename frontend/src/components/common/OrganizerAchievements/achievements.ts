import {t} from "@lingui/macro";
import {i18n} from "@lingui/core";
import {
    IconCreditCard,
    IconFlag,
    IconHeartHandshake,
    IconMountain,
    IconPhoto,
    IconScan,
    IconTent,
    IconTicket,
    IconTrophy,
    IconUsersGroup,
    Icon,
} from "@tabler/icons-react";
import {OrganizerAchievementKey, OrganizerAchievementProgress} from "../../../types.ts";

export interface AchievementDefinition {
    icon: Icon;
    // Figma « Admin · Succès »: the solid background of its card, and the disc of the badge
    background: string;
    badge: string;
    title: string;
    description: string;
}

// In the page's language, « 10 000 $ » in French
const numberLocale = () => i18n.locale?.startsWith('fr') ? 'fr-CA' : (i18n.locale || 'fr-CA');

const formatAmount = (amount: number, currency: string) => new Intl.NumberFormat(
    numberLocale(),
    {style: 'currency', currency, maximumFractionDigits: 0},
).format(amount);

/**
 * Icon, colours and texts of the ten achievements. The server decides what is earned.
 * Kept in sync with backend/app/DomainObjects/Enums/OrganizerAchievement.php.
 */
export const achievementDefinition = (key: OrganizerAchievementKey, currency: string): AchievementDefinition => {
    switch (key) {
        case 'first_event':
            return {
                icon: IconTent, background: '#b9d7a8', badge: '#6e9e5a',
                title: t`Base Camp`,
                description: t`Create your first event.`,
            };
        case 'organizer_page':
            return {
                icon: IconPhoto, background: '#9cc9e3', badge: '#4e8db3',
                title: t`Storefront`,
                description: t`Add a logo and a cover image to your organizer page.`,
            };
        case 'payments_connected':
            return {
                icon: IconCreditCard, background: '#f4a7b9', badge: '#c9627d',
                title: t`Open for Business`,
                description: t`Connect Stripe to receive your payments.`,
            };
        case 'event_published':
            return {
                icon: IconFlag, background: '#f6c85f', badge: '#c4911e',
                title: t`Trailhead`,
                description: t`Publish an event.`,
            };
        case 'first_order':
            return {
                icon: IconTicket, background: '#c5b4e3', badge: '#8268b5',
                title: t`First Ticket`,
                description: t`Receive a first order from a participant.`,
            };
        case 'first_check_in':
            return {
                icon: IconScan, background: '#8fd3c1', badge: '#3e9c85',
                title: t`Welcome!`,
                description: t`Check in your first participant at the event.`,
            };
        case 'hundred_attendees':
            return {
                icon: IconUsersGroup, background: '#f9a66c', badge: '#c9662a',
                title: t`Peloton`,
                description: t`Reach 100 registered participants.`,
            };
        case 'regular_attendees':
            return {
                icon: IconHeartHandshake, background: '#a7b8f4', badge: '#5a6fc2',
                title: t`Regulars`,
                description: t`10 participants come back for another one of your events.`,
            };
        case 'sales_summit': {
            const amount = formatAmount(10_000, currency);
            return {
                icon: IconMountain, background: '#e3c08f', badge: '#a9803e',
                title: t`Summit`,
                description: t`Reach ${amount} in sales.`,
            };
        }
        case 'full_season':
            return {
                icon: IconTrophy, background: '#d98c7a', badge: '#a24e3b',
                title: t`Full Season`,
                description: t`Hold 5 events with participants.`,
            };
    }
};

/**
 * "40 / 100", or amounts for the sales one. Null when there is a single step.
 */
export const progressLabel = (achievement: OrganizerAchievementProgress, currency: string): string | null => {
    if (achievement.target <= 1) {
        return null;
    }

    const format = achievement.key === 'sales_summit'
        ? (value: number) => formatAmount(value, currency)
        : (value: number) => new Intl.NumberFormat(numberLocale()).format(value);

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
