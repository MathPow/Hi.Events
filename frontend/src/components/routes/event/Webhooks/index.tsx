import {t} from "@lingui/macro";
import {Button} from "@mantine/core";
import {WebhookListSkeleton} from "../../../common/WebhookTable/WebhookList.tsx";
import {IconPlus} from "@tabler/icons-react";
import {useDisclosure} from "@mantine/hooks";
import {useParams} from "react-router";
import {PageTitle} from "../../../common/PageTitle";
import {PageBody} from "../../../common/PageBody";
import {WebhookTable} from "../../../common/WebhookTable";
import {useGetWebhooks} from "../../../../queries/useGetWebhooks.ts";
import {CreateWebhookModal} from "../../../modals/CreateWebhookModal";

const Webhooks = () => {
    const {eventId} = useParams();
    const [createModalOpen, {open: openCreateModal, close: closeCreateModal}] = useDisclosure(false);
    const webhooksQuery = useGetWebhooks(eventId);
    const webhooks = webhooksQuery.data?.data?.data;

    return (
        <PageBody>
            <PageTitle
                subheading={t`Send real-time order and attendee data to your external systems.`}
                actions={(
                    <Button leftSection={<IconPlus size={20}/>} onClick={openCreateModal}>
                        {t`Add Webhook`}
                    </Button>
                )}
            >
                {t`Webhooks`}
            </PageTitle>

            {!webhooks && <WebhookListSkeleton/>}
            {webhooks && <WebhookTable webhooks={webhooks} openCreateModal={openCreateModal}/>}

            {createModalOpen && <CreateWebhookModal onClose={closeCreateModal}/>}
        </PageBody>
    );
};

export default Webhooks;
