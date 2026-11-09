import {useMutation, useQueryClient} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {
    DocumentTemplateKey,
    organizerDocumentClient,
    OrganizerDocument,
    OrganizerDocumentChanges,
} from "../api/organizerDocument.client.ts";
import {
    GET_ORGANIZER_DOCUMENT_QUERY_KEY,
    GET_ORGANIZER_DOCUMENTS_QUERY_KEY,
} from "../queries/useGetOrganizerDocuments.ts";

const useRefreshList = () => {
    const queryClient = useQueryClient();

    return (organizerId: IdParam) => queryClient.invalidateQueries({queryKey: [GET_ORGANIZER_DOCUMENTS_QUERY_KEY, organizerId]});
};

export const useCreateOrganizerDocument = () => {
    const refresh = useRefreshList();

    return useMutation({
        mutationFn: ({organizerId, template}: { organizerId: IdParam, template: DocumentTemplateKey | null }) =>
            organizerDocumentClient.create(organizerId, template),
        onSuccess: (_, {organizerId}) => refresh(organizerId),
    });
};

export const useImportOrganizerDocumentPdf = () => {
    const refresh = useRefreshList();

    return useMutation({
        mutationFn: ({organizerId, file, onProgress}: {
            organizerId: IdParam,
            file: File,
            onProgress: (blocks: number) => void,
        }) => organizerDocumentClient.importPdf(organizerId, file, onProgress),
        onSuccess: (_, {organizerId}) => refresh(organizerId),
    });
};

export const useUpdateOrganizerDocument = () => {
    const queryClient = useQueryClient();
    const refresh = useRefreshList();

    return useMutation({
        mutationFn: ({organizerId, documentId, changes}: {
            organizerId: IdParam,
            documentId: IdParam,
            changes: OrganizerDocumentChanges
        }) => organizerDocumentClient.update(organizerId, documentId, changes),
        onSuccess: (document: OrganizerDocument, {organizerId, documentId}) => {
            queryClient.setQueryData([GET_ORGANIZER_DOCUMENT_QUERY_KEY, organizerId, documentId], document);
            return refresh(organizerId);
        },
    });
};

export const useDuplicateOrganizerDocument = () => {
    const refresh = useRefreshList();

    return useMutation({
        mutationFn: ({organizerId, documentId}: { organizerId: IdParam, documentId: IdParam }) =>
            organizerDocumentClient.duplicate(organizerId, documentId),
        onSuccess: (_, {organizerId}) => refresh(organizerId),
    });
};

export const useDeleteOrganizerDocument = () => {
    const refresh = useRefreshList();

    return useMutation({
        mutationFn: ({organizerId, documentId}: { organizerId: IdParam, documentId: IdParam }) =>
            organizerDocumentClient.remove(organizerId, documentId),
        onSuccess: (_, {organizerId}) => refresh(organizerId),
    });
};
