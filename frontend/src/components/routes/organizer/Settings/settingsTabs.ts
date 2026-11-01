import {t} from "@lingui/macro";

// The tabs of « Paramètres », by their address (/manage/organizer/1/settings/payments). They are also
// listed in the account menu (the profile button at the bottom of the sidebar).
export const SETTINGS_TABS = ['organization', 'payments', 'taxes', 'team'] as const;
export type SettingsTab = typeof SETTINGS_TABS[number];

export const settingsTabPath = (organizerId: string | number, tab: SettingsTab) =>
    `/manage/organizer/${organizerId}/settings/${tab}`;

export const settingsTabLabel = (tab: SettingsTab) => ({
    organization: t`Organization`,
    payments: t`Payments`,
    taxes: t`Taxes and receipts`,
    team: t`Team`,
})[tab];
