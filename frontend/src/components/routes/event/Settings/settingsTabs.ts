// The tabs of « Paramètres de l'événement », by their address (/manage/event/1/settings/payment).
export const EVENT_SETTINGS_TABS = ['event', 'registration', 'payment', 'emails'] as const;
export type EventSettingsTab = typeof EVENT_SETTINGS_TABS[number];

export const eventSettingsTabPath = (eventId: string | number, tab: EventSettingsTab) =>
    `/manage/event/${eventId}/settings/${tab}`;

// The sections of the former single page (…/settings#waitlist-settings) and the tab that holds them now;
// the card keeps the same id.
export const SECTION_TABS: Record<string, EventSettingsTab> = {
    'event-details': 'event',
    'location-settings': 'event',
    'seo-settings': 'event',
    'misc-settings': 'event',
    'danger-zone': 'event',
    'homepage-settings': 'registration',
    'information-block': 'registration',
    'waiver-settings': 'registration',
    'bib-number-settings': 'registration',
    'waitlist-settings': 'registration',
    'payment-settings': 'payment',
    'platform-fees': 'payment',
    'deposit-settings': 'payment',
    'invoice-settings': 'payment',
    'email-settings': 'emails',
    'email-templates': 'emails',
};
