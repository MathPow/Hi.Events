import {useMutation, useQueryClient} from "@tanstack/react-query";
import {adminClient} from "../api/admin.client";

export const useUpdateAssistantBudget = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (budget: number | null) => adminClient.updateAssistantBudget(budget),
        onSuccess: () => queryClient.invalidateQueries({queryKey: ['admin', 'assistant-usage']}),
    });
};
