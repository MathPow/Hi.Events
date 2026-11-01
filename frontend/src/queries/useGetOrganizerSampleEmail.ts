import {useQuery} from "@tanstack/react-query";
import {emailTemplateClient} from "../api/email-template.client";
import {AutomaticEmailType, IdParam} from "../types";

export const GET_ORGANIZER_SAMPLE_EMAIL_QUERY_KEY = 'getOrganizerSampleEmail';

export const useGetOrganizerSampleEmail = (organizerId: IdParam, templateType: AutomaticEmailType) => {
    return useQuery({
        queryKey: [GET_ORGANIZER_SAMPLE_EMAIL_QUERY_KEY, organizerId, templateType],
        queryFn: () => emailTemplateClient.getSampleForOrganizer(organizerId, templateType),
        enabled: !!organizerId,
    });
};
