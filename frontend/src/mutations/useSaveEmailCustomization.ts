import {useMutation, useQueryClient} from "@tanstack/react-query";
import {emailTemplateClient} from "../api/email-template.client";
import {EmailCustomizationType, IdParam} from "../types";
import {GET_EMAIL_TEMPLATES_QUERY_KEY} from "../queries/useGetEmailTemplates";
import {GET_ORGANIZER_SAMPLE_EMAIL_QUERY_KEY} from "../queries/useGetOrganizerSampleEmail";

// « Courriels »: the subject and message the organizer adds to a participant email (both empty: the default).
export const useSaveEmailCustomization = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({organizerId, templateType, subject, message}: {
            organizerId: IdParam;
            templateType: EmailCustomizationType;
            subject: string;
            message: string;
        }) => emailTemplateClient.saveCustomizationForOrganizer(organizerId, templateType, {subject, message}),

        onSuccess: (_, variables) => Promise.all([
            queryClient.invalidateQueries({queryKey: [GET_EMAIL_TEMPLATES_QUERY_KEY, 'organizer', variables.organizerId]}),
            queryClient.invalidateQueries({queryKey: [GET_ORGANIZER_SAMPLE_EMAIL_QUERY_KEY, variables.organizerId]}),
        ]),
    });
};
