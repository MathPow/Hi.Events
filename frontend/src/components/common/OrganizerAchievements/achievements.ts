import {t} from "@lingui/macro";
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
    // Patch colours once earned: background, then the icon drawn on it
    color: string;
    ink: string;
    title: string;
    description: string;
}

const CREME = '#fff7e9';
const BRUN = '#352924';

const formatAmount = (amount: number, currency: string) => new Intl.NumberFormat(
    typeof window !== 'undefined' ? navigator.language : 'fr-CA',
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
                icon: IconTent, color: '#4f7a5a', ink: CREME,
                title: t`Base Camp`,
                description: t`Create your first event.`,
            };
        case 'organizer_page':
            return {
                icon: IconPhoto, color: '#c47762', ink: CREME,
                title: t`Storefront`,
                description: t`Add a logo and a cover image to your organizer page.`,
            };
        case 'payments_connected':
            return {
                icon: IconCreditCard, color: '#3f7090', ink: CREME,
                title: t`Open for Business`,
                description: t`Connect Stripe to receive your payments.`,
            };
        case 'event_published':
            return {
                icon: IconFlag, color: '#fa7853', ink: BRUN,
                title: t`Trailhead`,
                description: t`Publish an event.`,
            };
        case 'first_order':
            return {
                icon: IconTicket, color: '#e0a83e', ink: BRUN,
                title: t`First Ticket`,
                description: t`Receive a first order from a participant.`,
            };
        case 'first_check_in':
            return {
                icon: IconScan, color: '#3e8a85', ink: CREME,
                title: t`Welcome!`,
                description: t`Check in your first participant at the event.`,
            };
        case 'hundred_attendees':
            return {
                icon: IconUsersGroup, color: '#b5553c', ink: CREME,
                title: t`Peloton`,
                description: t`Reach 100 registered participants.`,
            };
        case 'regular_attendees':
            return {
                icon: IconHeartHandshake, color: '#9b4f6e', ink: CREME,
                title: t`Regulars`,
                description: t`10 participants come back for another one of your events.`,
            };
        case 'sales_summit': {
            const amount = formatAmount(10_000, currency);
            return {
                icon: IconMountain, color: '#4d5d78', ink: CREME,
                title: t`Summit`,
                description: t`Reach ${amount} in sales.`,
            };
        }
        case 'full_season':
            return {
                icon: IconTrophy, color: BRUN, ink: '#f0c060',
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
        : (value: number) => new Intl.NumberFormat().format(value);

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
