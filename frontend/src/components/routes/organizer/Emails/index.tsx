import {useParams} from "react-router";
import {t} from "@lingui/macro";
import {PageBody} from "../../../common/PageBody";
import {PageTitle} from "../../../common/PageTitle";
import {AutomaticEmails} from "./AutomaticEmails.tsx";
import {EmailFooterCard} from "./EmailFooterCard.tsx";
import {useGetOrganizerSettings} from "../../../../queries/useGetOrganizerSettings.ts";
import classes from "./Emails.module.scss";

// « Courriels automatiques », under « Gérer » like « Documents »: the automatic emails, exactly as
// they are sent. Not « Courriels » alone, which was confused with « Messages » (the emails you write).
const Emails = () => {
    const {organizerId} = useParams();
    const {data: settings} = useGetOrganizerSettings(organizerId);

    if (!organizerId) {
        return null;
    }

    return (
        <PageBody>
            <PageTitle subheading={t`The emails your buyers and attendees receive automatically.`}>
                {t`Automatic emails`}
            </PageTitle>
            <AutomaticEmails key={organizerId} organizerId={organizerId}/>
            {settings && (
                <div className={classes.footerCard}>
                    <EmailFooterCard key={organizerId} organizerId={organizerId} settings={settings}/>
                </div>
            )}
        </PageBody>
    );
};

export default Emails;
