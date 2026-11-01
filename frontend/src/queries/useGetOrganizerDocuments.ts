import {useQuery} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {organizerDocumentClient} from "../api/organizerDocument.client.ts";

export const GET_ORGANIZER_DOCUMENTS_QUERY_KEY = 'getOrganizerDocuments';
export const GET_ORGANIZER_DOCUMENT_QUERY_KEY = 'getOrganizerDocument';
export const GET_EVENT_DOCUMENTS_PUBLIC_QUERY_KEY = 'getEventDocumentsPublic';
export const GET_ATTENDEE_DOCUMENTS_QUERY_KEY = 'getAttendeeDocuments';

export const useGetOrganizerDocuments = (organizerId: IdParam) => useQuery({
    queryKey: [GET_ORGANIZER_DOCUMENTS_QUERY_KEY, organizerId],
    enabled: !!organizerId,
    queryFn: () => organizerDocumentClient.list(organizerId),
});

// L'editeur garde sa copie de travail: pas de relecture qui ecraserait une frappe en cours.
export const useGetOrganizerDocument = (organizerId: IdParam, documentId: IdParam) => useQuery({
    queryKey: [GET_ORGANIZER_DOCUMENT_QUERY_KEY, organizerId, documentId],
    enabled: !!organizerId && !!documentId,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    queryFn: () => organizerDocumentClient.get(organizerId, documentId),
});

// Les documents lies a un evenement, pour la caisse.
export const useGetEventDocumentsPublic = (eventId: IdParam) => useQuery({
    queryKey: [GET_EVENT_DOCUMENTS_PUBLIC_QUERY_KEY, eventId],
    enabled: !!eventId,
    staleTime: 60_000,
    queryFn: () => organizerDocumentClient.forEvent(eventId),
});

export const useGetAttendeeDocuments = (eventId: IdParam, attendeeId: IdParam) => useQuery({
    queryKey: [GET_ATTENDEE_DOCUMENTS_QUERY_KEY, eventId, attendeeId],
    enabled: !!eventId && !!attendeeId,
    queryFn: () => organizerDocumentClient.attendeeCopies(eventId, attendeeId),
});
