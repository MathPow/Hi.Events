import {Navigate, useLocation, useParams} from "react-router";
import {useGetOrganizers} from "../../../queries/useGetOrganizers.ts";
import {OrganizerStatus} from "../../../types.ts";
import {lastOrganizerId} from "../../../utilites/lastOrganizer.ts";

/**
 * The back office's pages without an organizer in their address (/manage/events, /manage/profile, the
 * email confirmations) open inside the organizer's space: the organizer last opened, else the first
 * active one. `to` gets its id (and the route's params); the query string is kept.
 */
export const OrganizerRedirect = ({to}: { to: (organizerId: number, params: Record<string, string | undefined>) => string }) => {
    const params = useParams();
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

    const target = to(organizer.id as number, params);
    const separator = target.includes('?') ? '&' : '?';
    return <Navigate to={location.search ? target + separator + location.search.slice(1) : target} replace/>;
};

// /manage/events (the former dashboard of all the events): the organizer's dashboard.
export const DashboardRedirect = () => <OrganizerRedirect to={(id) => `/manage/organizer/${id}/dashboard`}/>;

// /manage/profile: « My profile », in the organizer's space.
export const ProfileRedirect = () => <OrganizerRedirect to={(id) => `/manage/organizer/${id}/profile`}/>;

// The links of the emails: the profile page confirms the address (or shows the change to confirm).
export const ConfirmEmailAddressRedirect = () => (
    <OrganizerRedirect to={(id, {token}) => `/manage/organizer/${id}/profile?confirm-email=${encodeURIComponent(token ?? '')}`}/>
);

export const ConfirmEmailChangeRedirect = () => (
    <OrganizerRedirect to={(id, {token}) => `/manage/organizer/${id}/profile?confirm-email-change=${encodeURIComponent(token ?? '')}`}/>
);
