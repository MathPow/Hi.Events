import {Navigate, useLocation, useParams} from "react-router";
import {useGetOrganizers} from "../../../queries/useGetOrganizers.ts";
import {OrganizerStatus} from "../../../types.ts";
import {lastOrganizerId} from "../../../utilites/lastOrganizer.ts";
import {settingsTabPath, SettingsTab} from "../organizer/Settings/settingsTabs.ts";

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
const AccountSettingsRedirect = () => {
    const {section} = useParams();
    const location = useLocation();
    const {data, isFetched} = useGetOrganizers();

    if (!isFetched) {
        return null;
    }

    const organizers = data?.data ?? [];
    if (organizers.length === 0) {
        return <Navigate to="/welcome" replace/>;
    }

    const remembered = lastOrganizerId();
    const organizer = organizers.find(org => String(org.id) === remembered)
        ?? organizers.find(org => org.status !== OrganizerStatus.ARCHIVED)
        ?? organizers[0];

    return <Navigate to={settingsTabPath(organizer.id as number, TAB_OF_SECTION[section ?? ''] ?? 'organization') + location.search} replace/>;
};

export default AccountSettingsRedirect;
