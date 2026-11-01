import {SETTINGS_TABS, settingsTabPath, SettingsTab} from "../organizer/Settings/settingsTabs.ts";
import {OrganizerRedirect} from "./OrganizerRedirect.tsx";

// The former « Paramètres du compte » pages, now sections of the organizer's « Paramètres »; and the
// sections themselves (/account/payments), linked from the account menu outside an organizer.
const TAB_OF_SECTION: Record<string, SettingsTab> = {
    ...Object.fromEntries(SETTINGS_TABS.map(tab => [tab, tab])),
    'settings': 'team',
    'users': 'team',
    'api-tokens': 'team',
    'taxes-and-fees': 'taxes',
    'payment': 'payments',
    'event-defaults': 'organization',
};

// /account/... keeps working (help center, Stripe's return link): it opens the matching tab of the
// organizer last opened, else the first active one. The query string (Stripe's) is kept.
const AccountSettingsRedirect = () => (
    <OrganizerRedirect to={(id, {section}) => settingsTabPath(id, TAB_OF_SECTION[section ?? ''] ?? 'organization')}/>
);

export default AccountSettingsRedirect;
