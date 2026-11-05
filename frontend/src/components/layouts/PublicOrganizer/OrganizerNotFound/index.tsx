import {t} from '@lingui/macro';
import {IconCalendarPlus} from '@tabler/icons-react';
import {GenericErrorPage} from "../../../common/GenericErrorPage";
import {isHiEvents} from "../../../../utilites/helpers.ts";

export const OrganizerNotFound = () => {
    return (
        <GenericErrorPage
            title={t`Organizer Not Found`}
            description={t`The organizer you're looking for could not be found. The page may have been moved, deleted, or the URL might be incorrect.`}
            pageTitle={t`Organizer Not Found`}
            metaDescription={t`The organizer you're looking for could not be found. The page may have been moved, deleted, or the URL might be incorrect.`}
            buttonText={isHiEvents() ? t`Create your own event` : undefined}
            buttonUrl={isHiEvents() ? "https://app.hi.events/auth/register?utm_source=app.hi.events&utm_content=organizer-not-found/create-event" : undefined}
            buttonIcon={<IconCalendarPlus size={18}/>}
        />
    );
};

export default OrganizerNotFound;
