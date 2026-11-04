import {IdParam} from "../../../../../types.ts";
import {useGetOrganizer} from "../../../../../queries/useGetOrganizer.ts";
import {useGetOrganizerSettings} from "../../../../../queries/useGetOrganizerSettings.ts";
import {BasicInfoCard} from "../organization/BasicInfoCard.tsx";
import {AddressCard} from "../organization/AddressCard.tsx";
import {SocialLinksCard} from "../organization/SocialLinksCard.tsx";
import {EventDefaultsCard} from "../organization/EventDefaultsCard.tsx";
import {SeoCard} from "../organization/SeoCard.tsx";
import {DangerZoneCard} from "../organization/DangerZoneCard.tsx";
import {OrganizationTabSkeleton} from "./TabSkeletons.tsx";
import classes from "../Settings.module.scss";

// « Organisation »: the organizer's details, address, networks, event defaults, Google and the danger zone.
export const OrganizationTab = ({organizerId}: { organizerId: IdParam }) => {
    const {data: organizer} = useGetOrganizer(organizerId);
    const {data: settings} = useGetOrganizerSettings(organizerId);

    // The forms start from the saved values once; later refetches don't overwrite what is being typed.
    if (!organizer || !settings) {
        return <OrganizationTabSkeleton/>;
    }

    return (
        <div className={classes.grid}>
            <BasicInfoCard organizerId={organizerId} organizer={organizer}/>
            <AddressCard organizerId={organizerId} settings={settings}/>
            <SocialLinksCard organizerId={organizerId} settings={settings}/>
            <EventDefaultsCard organizerId={organizerId} settings={settings}/>
            <SeoCard organizerId={organizerId} organizer={organizer} settings={settings}/>
            <DangerZoneCard organizerId={organizerId}/>
        </div>
    );
};
