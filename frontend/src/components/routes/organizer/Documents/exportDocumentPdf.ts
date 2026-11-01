import {t} from "@lingui/macro";
import {IdParam} from "../../../../types.ts";
import {organizerDocumentClient, OrganizerDocument} from "../../../../api/organizerDocument.client.ts";
import {downloadBinary} from "../../../../utilites/download.ts";
import {showError} from "../../../../utilites/notifications.tsx";

/** Le document vierge en PDF, telecharge. */
export const exportDocumentPdf = async (organizerId: IdParam, document: Pick<OrganizerDocument, 'id' | 'title'>) => {
    try {
        const pdf = await organizerDocumentClient.pdf(organizerId, document.id);
        downloadBinary(pdf, `${document.title}.pdf`);
    } catch {
        showError(t`The PDF could not be created. Please try again.`);
    }
};
