import {settingsTabPath, SettingsTab} from "../organizer/Settings/settingsTabs.ts";
import {OrganizerRedirect} from "./OrganizerRedirect.tsx";

// The former « Paramètres du compte » pages, now tabs of the organizer's « Paramètres ».
const TAB_OF_SECTION: Record<string, SettingsTab> = {
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
