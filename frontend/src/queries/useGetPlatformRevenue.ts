import {useQuery} from "@tanstack/react-query";
import {adminClient, GetPlatformRevenueParams} from "../api/admin.client";

export const useGetPlatformRevenue = (params: GetPlatformRevenueParams = {}) => {
    return useQuery({
        queryKey: ['admin', 'platform-revenue', params.days, params.months, params.topContributors],
        queryFn: () => adminClient.getPlatformRevenue(params),
    });
};
