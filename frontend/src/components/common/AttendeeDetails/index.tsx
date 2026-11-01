import {Anchor} from "@mantine/core";
import {useParams} from "react-router";
import {Attendee, Product} from "../../../types.ts";
import classes from "./AttendeeDetails.module.scss";
import {t} from "@lingui/macro";
import {getAttendeeProductTitle} from "../../../utilites/products.ts";
import {getLocaleName, SupportedLocales} from "../../../locales.ts";
import {relativeDate} from "../../../utilites/dates.ts";
import {useGetAttendeeDocuments} from "../../../queries/useGetOrganizerDocuments.ts";
import {organizerDocumentClient} from "../../../api/organizerDocument.client.ts";
import {downloadBinary} from "../../../utilites/download.ts";
import {showError} from "../../../utilites/notifications.tsx";

export const AttendeeDetails = ({attendee}: { attendee: Attendee }) => {
    return (
        <div className={classes.orderDetails}>
            <div className={classes.block}>
                <div className={classes.title}>
                    {t`Name`}
                </div>
                <div className={classes.amount}>
                    {attendee.first_name} {attendee.last_name}
                </div>
            </div>
            {attendee.bib_number && (
                <div className={classes.block}>
                    <div className={classes.title}>
                        {t`Bib number`}
                    </div>
                    <div className={classes.amount}>
                        {attendee.bib_number}
                    </div>
                </div>
            )}
            <div className={classes.block}>
                <div className={classes.title}>
                    {t`Email`}
                </div>
                <div className={classes.value}>
                    <Anchor href={'mailto:' + attendee.email} target={'_blank'}>{attendee.email}</Anchor>
                </div>
            </div>
            <div className={classes.block}>
                <div className={classes.title}>
                    {t`Product`}
                </div>
                <div className={classes.amount}>
                    {getAttendeeProductTitle(attendee, attendee.product as Product)}
                </div>
            </div>
            <div className={classes.block}>
                <div className={classes.title}>
                    {t`Language`}
                </div>
                <div className={classes.amount}>
                    {getLocaleName(attendee.locale as SupportedLocales)}
                </div>
            </div>
            {attendee.waiver_signed_at && (
                <div className={classes.block}>
                    <div className={classes.title}>
                        {t`Waiver`}
                    </div>
                    <div className={classes.value}>
                        {t`Signed by ${attendee.waiver_signed_name}`} - {relativeDate(attendee.waiver_signed_at)}
                        {attendee.waiver_guardian_name && (
                            <div>{t`Parent or guardian: ${attendee.waiver_guardian_name}`}</div>
                        )}
                    </div>
                </div>
            )}
            <AttendeeDocuments attendee={attendee}/>
            {attendee.check_ins && attendee.check_ins.length > 0 && (
                <div className={classes.block}>
                    <div className={classes.title}>
                        {t`Check-Ins`}
                    </div>
                    <div className={classes.value}>
                        {attendee.check_ins.map((checkIn) => (
                            <div key={checkIn.id}>
                                <strong>{checkIn.check_in_list?.name}</strong> - {relativeDate(checkIn.created_at)}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Les copies des documents de l'organisateur pour ce participant: signees en
 * ligne (par qui, quand) ou envoyees a imprimer, chacune en PDF.
 */
const AttendeeDocuments = ({attendee}: { attendee: Attendee }) => {
    const {eventId} = useParams();
    const {data: copies} = useGetAttendeeDocuments(eventId, attendee.id);

    if (!copies?.length) {
        return null;
    }

    const download = async (copyId: number, title: string) => {
        try {
            const pdf = await organizerDocumentClient.attendeeCopyPdf(eventId, attendee.id, copyId);
            // Un nom de fichier, pas un texte a traduire.
            // eslint-disable-next-line lingui/no-unlocalized-strings
            downloadBinary(pdf, `${title} - ${attendee.first_name} ${attendee.last_name}.pdf`);
        } catch {
            showError(t`The PDF could not be created. Please try again.`);
        }
    };

    return (
        <div className={classes.block}>
            <div className={classes.title}>
                {t`Documents`}
            </div>
            <div className={classes.value}>
                {copies.map(copy => (
                    <div key={copy.id}>
                        <Anchor component="button" type="button" onClick={() => download(copy.id, copy.title)}>
                            {copy.title}
                        </Anchor>
                        {' - '}
                        {copy.signed_at
                            ? <SignedBy names={[copy.signer_name, copy.guardian_name].filter(Boolean).join(', ')} date={copy.signed_at}/>
                            : t`To print (sent with the ticket)`}
                    </div>
                ))}
            </div>
        </div>
    );
};

const SignedBy = ({names, date}: { names: string, date: string }) => {
    const when = relativeDate(date);
    return <>{t`Signed by ${names}`} - {when}</>;
};
