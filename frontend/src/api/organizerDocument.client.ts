import {JSONContent} from "@tiptap/core";
import {api} from "./client";
import {publicApi} from "./public-client.ts";
import {IdParam} from "../types.ts";
import {getConfig} from "../utilites/config.ts";

// Les blocs d'un document, comme l'editeur les enregistre (DocumentBlocks cote serveur).
export type DocumentBlockType =
    'title' | 'paragraph' | 'clause' | 'list' | 'field' | 'checkbox' | 'signature' | 'separator';

export type DocumentSigner = 'participant' | 'guardian';

export type DocumentAutoField = 'participant_name' | 'date_of_birth' | 'event_name' | 'event_date' | 'organizer_name';

export const DOCUMENT_AUTO_FIELDS: DocumentAutoField[] = [
    'participant_name', 'date_of_birth', 'event_name', 'event_date', 'organizer_name',
];

// La signature du participant quand le document n'a pas de bloc de signature a lui.
export const IMPLICIT_SIGNATURE = '_signature';

export interface DocumentBlock {
    id: string;
    type: DocumentBlockType;
    // title, paragraph, clause, list, checkbox: le texte (JSON de TipTap).
    content?: JSONContent;
    // field: l'intitule de la ligne a remplir.
    label?: string;
    // field, checkbox
    required?: boolean;
    // signature
    signer?: DocumentSigner;
}

export type DocumentSigningMode = 'ONLINE' | 'PRINT';
export type DocumentAudience = 'ALL' | 'MINORS';

export type DocumentTemplateKey = 'parental_consent' | 'liability_waiver' | 'medical_form' | 'photo_consent' | 'blank';

export interface OrganizerDocument {
    id: number;
    organizer_id: number;
    title: string;
    blocks: DocumentBlock[];
    signing_mode: DocumentSigningMode;
    audience: DocumentAudience;
    // « Selon l'âge » (MINORS): under this age on the event's day; empty, the age of majority (18).
    audience_age: number | null;
    template: DocumentTemplateKey | null;
    event_ids: number[];
    created_at: string;
    updated_at: string;
}

export type OrganizerDocumentChanges = Partial<Pick<OrganizerDocument, 'title' | 'blocks' | 'signing_mode' | 'audience' | 'audience_age' | 'event_ids'>>;

// Ce que l'acheteur lit et remplit a la caisse.
export interface PublicOrganizerDocument {
    id: number;
    title: string;
    blocks: DocumentBlock[];
    signing_mode: DocumentSigningMode;
    audience: DocumentAudience;
    // Its age limit when it is « selon l'âge », else null.
    audience_age: number | null;
}

// La copie d'un participant: signee en ligne, ou a imprimer.
export interface AttendeeDocumentCopy {
    id: number;
    organizer_document_id: number | null;
    attendee_id: number;
    title: string;
    signing_mode: DocumentSigningMode;
    signer_name: string | null;
    guardian_name: string | null;
    signed_at: string | null;
    created_at: string;
}

export const organizerDocumentClient = {
    list: async (organizerId: IdParam) => {
        const response = await api.get<{ data: OrganizerDocument[] }>(`organizers/${organizerId}/documents`);
        return response.data.data;
    },

    get: async (organizerId: IdParam, documentId: IdParam) => {
        const response = await api.get<{ data: OrganizerDocument }>(`organizers/${organizerId}/documents/${documentId}`);
        return response.data.data;
    },

    create: async (organizerId: IdParam, template: DocumentTemplateKey | null) => {
        const response = await api.post<{ data: OrganizerDocument }>(`organizers/${organizerId}/documents`, {template});
        return response.data.data;
    },

    // The assistant rebuilds the PDF as a document. The answer streams (NDJSON) so a long read
    // isn't cut by the proxy: progress lines with the blocks written so far, then the document.
    importPdf: async (organizerId: IdParam, file: File, onProgress: (blocks: number) => void): Promise<OrganizerDocument> => {
        const body = new FormData();
        body.append('file', file);
        const response = await fetch(`${getConfig('VITE_API_URL_CLIENT')}/organizers/${organizerId}/documents/import`, {
            method: 'POST',
            credentials: 'include',
            headers: {Accept: 'application/x-ndjson, application/json'},
            body,
        });
        if (!response.ok || !response.body) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error?.errors?.file?.[0] ?? error?.message ?? '');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (; ;) {
            const {done, value} = await reader.read();
            if (done) {
                break;
            }
            buffer += decoder.decode(value, {stream: true});
            let end: number;
            while ((end = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, end).trim();
                buffer = buffer.slice(end + 1);
                if (!line) {
                    continue;
                }
                const event = JSON.parse(line);
                if (event.type === 'progres') {
                    onProgress(event.blocs);
                } else if (event.type === 'erreur') {
                    throw new Error(event.texte);
                } else if (event.type === 'fin') {
                    return event.document as OrganizerDocument;
                }
            }
        }
        throw new Error('');
    },

    update: async (organizerId: IdParam, documentId: IdParam, changes: OrganizerDocumentChanges) => {
        const response = await api.patch<{ data: OrganizerDocument }>(`organizers/${organizerId}/documents/${documentId}`, changes);
        return response.data.data;
    },

    duplicate: async (organizerId: IdParam, documentId: IdParam) => {
        const response = await api.post<{ data: OrganizerDocument }>(`organizers/${organizerId}/documents/${documentId}/duplicate`);
        return response.data.data;
    },

    remove: async (organizerId: IdParam, documentId: IdParam) => {
        await api.delete(`organizers/${organizerId}/documents/${documentId}`);
    },

    pdf: async (organizerId: IdParam, documentId: IdParam): Promise<Blob> => {
        const response = await api.get(`organizers/${organizerId}/documents/${documentId}/pdf`, {responseType: 'blob'});
        return new Blob([response.data], {type: 'application/pdf'});
    },

    forEvent: async (eventId: IdParam) => {
        const response = await publicApi.get<{ data: PublicOrganizerDocument[] }>(`events/${eventId}/documents`);
        return response.data.data;
    },

    attendeeCopies: async (eventId: IdParam, attendeeId: IdParam) => {
        const response = await api.get<{ data: AttendeeDocumentCopy[] }>(`events/${eventId}/attendees/${attendeeId}/documents`);
        return response.data.data;
    },

    attendeeCopyPdf: async (eventId: IdParam, attendeeId: IdParam, copyId: IdParam): Promise<Blob> => {
        const response = await api.get(`events/${eventId}/attendees/${attendeeId}/documents/${copyId}/pdf`, {responseType: 'blob'});
        return new Blob([response.data], {type: 'application/pdf'});
    },
};
