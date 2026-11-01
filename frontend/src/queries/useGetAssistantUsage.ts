import {keepPreviousData, useQuery} from "@tanstack/react-query";
import {adminClient} from "../api/admin.client";

export const useGetAssistantUsage = (days: number) => {
    return useQuery({
        queryKey: ['admin', 'assistant-usage', days],
        queryFn: () => adminClient.getAssistantUsage(days),
        placeholderData: keepPreviousData,
    });
};
