import {useParams} from "react-router";
import {t} from "@lingui/macro";
import {PageBody} from "../../../common/PageBody";
import {PageTitle} from "../../../common/PageTitle";
import {AutomaticEmails} from "./AutomaticEmails.tsx";

// « Courriels », under « Gérer » like « Documents »: the automatic emails, exactly as they are sent.
const Emails = () => {
    const {organizerId} = useParams();

    if (!organizerId) {
        return null;
    }

    return (
        <PageBody>
            <PageTitle subheading={t`The emails your buyers and attendees receive automatically.`}>
                {t`Emails`}
            </PageTitle>
            <AutomaticEmails key={organizerId} organizerId={organizerId}/>
        </PageBody>
    );
};

export default Emails;
