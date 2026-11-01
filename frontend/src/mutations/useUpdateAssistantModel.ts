import {useMutation, useQueryClient} from "@tanstack/react-query";
import {adminClient} from "../api/admin.client";

export const useUpdateAssistantModel = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (model: string | null) => adminClient.updateAssistantModel(model),
        onSuccess: () => queryClient.invalidateQueries({queryKey: ['admin', 'assistant-usage']}),
    });
};
