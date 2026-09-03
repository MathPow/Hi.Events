import {useQuery} from '@tanstack/react-query';
import {DoorSaleProduct, GenericDataResponse, IdParam} from '../types';
import {publicCheckInClient} from "../api/check-in.client";

export const GET_DOOR_SALE_PRODUCTS_PUBLIC_QUERY_KEY = 'getDoorSaleProducts';

export const useGetDoorSaleProductsPublic = (checkInListShortId: IdParam, enabled: boolean = true) => {
    return useQuery<GenericDataResponse<DoorSaleProduct[]>>({
        queryKey: [GET_DOOR_SALE_PRODUCTS_PUBLIC_QUERY_KEY, checkInListShortId],
        queryFn: async () => {
            return await publicCheckInClient.getDoorSaleProducts(checkInListShortId);
        },
        enabled: enabled,
    });
};
