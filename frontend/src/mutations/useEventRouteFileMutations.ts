import {useMutation, useQueryClient} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {eventRouteFileClient} from "../api/eventRouteFile.client.ts";
import {GET_EVENT_ROUTE_FILES_QUERY_KEY} from "../queries/useGetEventRouteFiles.ts";

const useRefreshList = () => {
    const queryClient = useQueryClient();

    return (eventId: IdParam) => queryClient.invalidateQueries({queryKey: [GET_EVENT_ROUTE_FILES_QUERY_KEY, eventId]});
};

export const useUploadEventRouteFile = () => {
    const refresh = useRefreshList();

    return useMutation({
        mutationFn: ({eventId, file, label}: { eventId: IdParam, file: File, label?: string }) =>
            eventRouteFileClient.upload(eventId, file, label),
        onSuccess: (_, {eventId}) => refresh(eventId),
    });
};

export const useReplaceEventRouteFile = () => {
    const refresh = useRefreshList();

    return useMutation({
        mutationFn: ({eventId, routeFileId, file, label}: { eventId: IdParam, routeFileId: IdParam, file: File, label?: string }) =>
            eventRouteFileClient.replace(eventId, routeFileId, file, label),
        onSuccess: (_, {eventId}) => refresh(eventId),
    });
};

export const useRenameEventRouteFile = () => {
    const refresh = useRefreshList();

    return useMutation({
        mutationFn: ({eventId, routeFileId, label}: { eventId: IdParam, routeFileId: IdParam, label: string }) =>
            eventRouteFileClient.rename(eventId, routeFileId, label),
        onSuccess: (_, {eventId}) => refresh(eventId),
    });
};

export const useDeleteEventRouteFile = () => {
    const refresh = useRefreshList();

    return useMutation({
        mutationFn: ({eventId, routeFileId}: { eventId: IdParam, routeFileId: IdParam }) =>
            eventRouteFileClient.delete(eventId, routeFileId),
        onSuccess: (_, {eventId}) => refresh(eventId),
    });
};
