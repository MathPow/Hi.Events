import {useQuery} from "@tanstack/react-query";
import {AxiosError} from "axios";
import {affiliateClientPublic, AffiliatePartnerPage} from "../api/affiliate.client.ts";

export const GET_AFFILIATE_PARTNER_PAGE_QUERY_KEY = 'getAffiliatePartnerPage';

export const useGetAffiliatePartnerPage = (token: string | undefined) => {
    return useQuery<AffiliatePartnerPage, AxiosError>({
        queryKey: [GET_AFFILIATE_PARTNER_PAGE_QUERY_KEY, token],
        queryFn: async () => {
            const {data} = await affiliateClientPublic.getPartnerPage(token as string);
            return data;
        },
        enabled: !!token,
        refetchOnWindowFocus: false,
        retry: false,
    });
};
