// The tabs of « Paramètres », by their address (/manage/organizer/1/settings/payments).
export const SETTINGS_TABS = ['organization', 'payments', 'taxes', 'emails', 'team'] as const;
export type SettingsTab = typeof SETTINGS_TABS[number];

export const settingsTabPath = (organizerId: string | number, tab: SettingsTab) =>
    `/manage/organizer/${organizerId}/settings/${tab}`;
