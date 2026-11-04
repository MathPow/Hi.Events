import {useState} from "react";
import {Link} from "react-router";
import {t} from "@lingui/macro";
import {Button, Skeleton} from "@mantine/core";
import {IdParam} from "../../../../../types.ts";
import {OrganizerDocument} from "../../../../../api/organizerDocument.client.ts";
import {useGetEvent} from "../../../../../queries/useGetEvent.ts";
import {useGetOrganizerDocuments} from "../../../../../queries/useGetOrganizerDocuments.ts";
import {useUpdateOrganizerDocument} from "../../../../../mutations/useOrganizerDocumentMutations.ts";
import {useAutosaveStatus} from "../../../../layouts/AppLayout/PageStatus.tsx";
import {showError} from "../../../../../utilites/notifications.tsx";
import {SettingsCard, ToggleRow} from "../../../organizer/Settings/SettingsUi.tsx";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

/**
 * « Documents à signer »: the organizer's documents (Documents page), each switched on or off for this
 * event, the same link as « Événements liés » in the document. Writing them stays in Documents.
 */
export const DocumentsCard = ({eventId}: { eventId: IdParam }) => {
    const {data: event} = useGetEvent(eventId);
    const organizerId = event?.organizer?.id ?? event?.organizer_id;
    const documentsQuery = useGetOrganizerDocuments(organizerId);
    const updateDocument = useUpdateOrganizerDocument();
    const track = useAutosaveStatus();
    // The switch moves at once; the list catches up when the server has saved it.
    const [pending, setPending] = useState<Record<number, boolean>>({});

    const id = Number(eventId);
    const documentsPath = `/manage/organizer/${organizerId}/documents`;
    const documents = documentsQuery.data ?? [];

    const link = (document: OrganizerDocument, linked: boolean) => {
        setPending((current) => ({...current, [document.id]: linked}));
        const eventIds = linked
            ? [...document.event_ids.filter((eventId) => eventId !== id), id]
            : document.event_ids.filter((eventId) => eventId !== id);
        const run = () => updateDocument.mutateAsync({
            organizerId: organizerId!,
            documentId: document.id,
            changes: {event_ids: eventIds},
        });

        track(`document-${document.id}`, run, () => link(document, linked))
            .catch(() => showError(t`The document could not be saved. Please try again.`))
            .finally(() => setPending(({[document.id]: _, ...rest}) => rest));
    };

    const details = (document: OrganizerDocument) => [
        document.signing_mode === 'ONLINE' ? t`Online signature` : t`PDF to print`,
        document.audience === 'MINORS' ? t`Minors only` : t`Everyone`,
    ].join(' · ');

    return (
        <SettingsCard
            id="document-settings"
            className={extra.anchored}
            title={t`Documents to sign`}
            subtitle={t`The waivers and forms of this event: signed online at checkout, or sent with the ticket to print. They are written in Documents and can serve several events.`}
            action={organizerId && (
                <Button component={Link} to={documentsPath} variant="transparent" className={classes.inkButton}>
                    {t`New document`}
                </Button>
            )}
        >
            {documentsQuery.isLoading || !organizerId ? (
                <>
                    <Skeleton height={44} radius="md"/>
                    <Skeleton height={44} radius="md"/>
                </>
            ) : documents.length === 0 ? (
                <p className={classes.softHint}>
                    {t`No documents yet. Create one, then switch it on here.`}
                </p>
            ) : (
                documents.map((document) => (
                    <ToggleRow
                        key={document.id}
                        label={document.title}
                        hint={(
                            <>
                                {details(document)}
                                {' · '}
                                <Link to={`${documentsPath}/${document.id}`} className={extra.inlineLink}>{t`Edit`}</Link>
                            </>
                        )}
                        checked={pending[document.id] ?? document.event_ids.includes(id)}
                        onChange={(linked) => link(document, linked)}
                    />
                ))
            )}
        </SettingsCard>
    );
};
