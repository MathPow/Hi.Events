import {useMutation} from "@tanstack/react-query";
import {emailTemplateClient} from "../api/email-template.client";
import {EmailTemplateType, IdParam} from "../types";

export const useSendOrganizerTestEmail = () => {
    return useMutation({
        mutationFn: ({organizerId, templateType}: { organizerId: IdParam, templateType: EmailTemplateType }) =>
            emailTemplateClient.sendTestForOrganizer(organizerId, templateType),
    });
};
