import {useCallback, useEffect, useRef, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {IdParam} from "../../../../../types.ts";
import {organizerDocumentClient, OrganizerDocument} from "../../../../../api/organizerDocument.client.ts";
import {useUpdateOrganizerDocument} from "../../../../../mutations/useOrganizerDocumentMutations.ts";
import {GET_ORGANIZER_DOCUMENTS_QUERY_KEY} from "../../../../../queries/useGetOrganizerDocuments.ts";

export type DocumentDraft = Pick<OrganizerDocument, 'title' | 'blocks' | 'signing_mode' | 'audience' | 'event_ids'>;

export type SaveStatus = 'saved' | 'saving' | 'error';

const SAVE_DELAY_MS = 800;

/**
 * L'enregistrement automatique de l'editeur: chaque changement part apres une
 * courte pause, un enregistrement a la fois (le dernier etat gagne), et ce qui
 * reste part quand on quitte la page.
 */
export const useDocumentAutosave = (organizerId: IdParam, documentId: IdParam, draft: DocumentDraft | null) => {
    const queryClient = useQueryClient();
    const {mutateAsync} = useUpdateOrganizerDocument();
    const [status, setStatus] = useState<SaveStatus>('saved');
    const [savedAt, setSavedAt] = useState<string | null>(null);
    const saved = useRef<string | null>(null);
    const latest = useRef<DocumentDraft | null>(draft);
    const inFlight = useRef<Promise<void> | null>(null);
    const timer = useRef<number | undefined>(undefined);

    latest.current = draft;

    const save = useCallback(async (): Promise<void> => {
        window.clearTimeout(timer.current);

        while (inFlight.current) {
            await inFlight.current;
        }

        const current = latest.current;
        if (!current) {
            return;
        }

        const serialized = JSON.stringify(current);
        if (serialized === saved.current) {
            setStatus('saved');
            return;
        }

        setStatus('saving');
        const request = mutateAsync({organizerId, documentId, changes: current})
            .then(() => {
                saved.current = serialized;
                setSavedAt(new Date().toISOString());
                setStatus(JSON.stringify(latest.current) === serialized ? 'saved' : 'saving');
            })
            .catch(() => setStatus('error'))
            .finally(() => {
                inFlight.current = null;
            });

        inFlight.current = request;
        await request;
    }, [mutateAsync, organizerId, documentId]);

    useEffect(() => {
        if (!draft) {
            return;
        }

        const serialized = JSON.stringify(draft);

        // Le document tel que le serveur l'a donne: rien a enregistrer.
        if (saved.current === null) {
            saved.current = serialized;
            return;
        }

        if (serialized === saved.current) {
            return;
        }

        setStatus('saving');
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(save, SAVE_DELAY_MS);
    }, [draft, save]);

    // En quittant la page: ce qui n'est pas encore enregistre part tout de suite.
    useEffect(() => {
        const unsaved = () => latest.current !== null && saved.current !== null
            && JSON.stringify(latest.current) !== saved.current;

        const warn = (event: BeforeUnloadEvent) => {
            if (unsaved()) {
                save();
                event.preventDefault();
            }
        };
        window.addEventListener('beforeunload', warn);

        return () => {
            window.removeEventListener('beforeunload', warn);
            window.clearTimeout(timer.current);
            if (unsaved() && latest.current) {
                organizerDocumentClient.update(organizerId, documentId, latest.current)
                    .then(() => queryClient.invalidateQueries({queryKey: [GET_ORGANIZER_DOCUMENTS_QUERY_KEY, organizerId]}))
                    .catch(() => undefined);
            }
        };
    }, [organizerId, documentId, queryClient, save]);

    return {status, savedAt, save};
};
