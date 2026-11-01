import {useMutation} from "@tanstack/react-query";
import {emailTemplateClient} from "../api/email-template.client";
import {AutomaticEmailType, IdParam} from "../types";

export const useSendOrganizerTestEmail = () => {
    return useMutation({
        mutationFn: ({organizerId, templateType}: { organizerId: IdParam, templateType: AutomaticEmailType }) =>
            emailTemplateClient.sendTestForOrganizer(organizerId, templateType),
    });
};
