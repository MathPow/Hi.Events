import {t} from "@lingui/macro";
import {useParams} from "react-router";
import {IdParam, Webhook} from '../../../types';
import {EditWebhookModal} from "../../modals/EditWebhookModal";
import {WebhookLogsModal} from "../../modals/WebhookLogsModal";
import {useDeleteWebhook} from "../../../mutations/useDeleteWebhook.ts";
import {showError, showSuccess} from "../../../utilites/notifications.tsx";
import {WebhookList} from "./WebhookList.tsx";

interface WebhookTableProps {
    webhooks: Webhook[];
    openCreateModal: () => void;
}

// The event's webhooks.
export const WebhookTable = ({webhooks, openCreateModal}: WebhookTableProps) => {
    const {eventId} = useParams();
    const deleteMutation = useDeleteWebhook();

    return (
        <WebhookList
            webhooks={webhooks}
            openCreateModal={openCreateModal}
            onDelete={(webhookId) => deleteMutation.mutate({eventId: eventId as IdParam, webhookId}, {
                onSuccess: () => showSuccess(t`Webhook deleted successfully`),
                onError: (error) => showError(error.message),
            })}
            editModal={(webhookId, onClose) => <EditWebhookModal webhookId={webhookId} onClose={onClose}/>}
            logsModal={(webhookId, onClose) => <WebhookLogsModal webhookId={webhookId} onClose={onClose}/>}
        />
    );
};
