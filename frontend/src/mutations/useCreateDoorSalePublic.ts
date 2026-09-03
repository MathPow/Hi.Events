import {useMutation, useQueryClient} from '@tanstack/react-query';
import {publicCheckInClient} from "../api/check-in.client";
import {GET_CHECK_IN_LIST_ATTENDEES_PUBLIC_QUERY_KEY} from "../queries/useGetCheckInListAttendeesPublic.ts";
import {GET_DOOR_SALE_PRODUCTS_PUBLIC_QUERY_KEY} from "../queries/useGetDoorSaleProductsPublic.ts";
import {DoorSaleRequest, IdParam} from "../types.ts";

export const useCreateDoorSalePublic = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({checkInListShortId, doorSale}: {
            checkInListShortId: IdParam,
            doorSale: DoorSaleRequest,
        }) => publicCheckInClient.createDoorSale(checkInListShortId, doorSale),

        onSuccess: (_, {checkInListShortId}) => {
            // A sale changes both what is left to sell and who is on the door list.
            queryClient.invalidateQueries({
                queryKey: [GET_DOOR_SALE_PRODUCTS_PUBLIC_QUERY_KEY, checkInListShortId],
            });
            queryClient.invalidateQueries({
                queryKey: [GET_CHECK_IN_LIST_ATTENDEES_PUBLIC_QUERY_KEY, checkInListShortId],
            });
        },
    });
};
