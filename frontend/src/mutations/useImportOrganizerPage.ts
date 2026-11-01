import {useMutation} from "@tanstack/react-query";
import {organizerClient} from "../api/organizer.client";
import {IdParam} from "../types";

export const useImportOrganizerPage = (organizerId: IdParam) => useMutation({
    mutationFn: (url: string) => organizerClient.importPage(organizerId, url),
});
