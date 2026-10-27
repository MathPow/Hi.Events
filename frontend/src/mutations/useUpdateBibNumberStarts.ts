import {useMutation, useQueryClient} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {BibNumberStart, bibNumberClient} from "../api/bib-number.client.ts";
import {GET_EVENT_PRODUCT_CATEGORIES_QUERY_KEY} from "../queries/useGetProductCategories.ts";

export const useUpdateBibNumberStarts = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({eventId, starts}: { eventId: IdParam, starts: BibNumberStart[] }) =>
            bibNumberClient.updateStarts(eventId, starts),

        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: [GET_EVENT_PRODUCT_CATEGORIES_QUERY_KEY, variables.eventId]
            });
        }
    });
}
