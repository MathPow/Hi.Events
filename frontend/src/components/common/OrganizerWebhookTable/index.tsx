import {t} from "@lingui/macro";
import {useParams} from "react-router";
import {IdParam, Webhook} from '../../../types';
import {EditOrganizerWebhookModal} from "../../modals/EditOrganizerWebhookModal";
import {OrganizerWebhookLogsModal} from "../../modals/OrganizerWebhookLogsModal";
import {useDeleteOrganizerWebhook} from "../../../mutations/useDeleteOrganizerWebhook.ts";
import {showError, showSuccess} from "../../../utilites/notifications.tsx";
import {WebhookList} from "../WebhookTable/WebhookList.tsx";

interface OrganizerWebhookTableProps {
    webhooks: Webhook[];
    openCreateModal: () => void;
}

// The organizer's webhooks (all its events).
export const OrganizerWebhookTable = ({webhooks, openCreateModal}: OrganizerWebhookTableProps) => {
    const {organizerId} = useParams();
    const deleteMutation = useDeleteOrganizerWebhook();

    return (
        <WebhookList
            webhooks={webhooks}
            openCreateModal={openCreateModal}
            onDelete={(webhookId) => deleteMutation.mutate({organizerId: organizerId as IdParam, webhookId}, {
                onSuccess: () => showSuccess(t`Webhook deleted successfully`),
                onError: (error) => showError(error.message),
            })}
            editModal={(webhookId, onClose) => <EditOrganizerWebhookModal webhookId={webhookId} onClose={onClose}/>}
            logsModal={(webhookId, onClose) => <OrganizerWebhookLogsModal webhookId={webhookId} onClose={onClose}/>}
        />
    );
};
