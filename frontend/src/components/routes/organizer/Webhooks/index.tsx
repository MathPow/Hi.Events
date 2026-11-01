import {t} from "@lingui/macro";
import {Button, Skeleton} from "@mantine/core";
import {IconPlus} from "@tabler/icons-react";
import {useDisclosure} from "@mantine/hooks";
import {useParams} from "react-router";
import {OrganizerWebhookTable} from "../../../common/OrganizerWebhookTable";
import {useGetOrganizerWebhooks} from "../../../../queries/useGetOrganizerWebhooks";
import {CreateOrganizerWebhookModal} from "../../../modals/CreateOrganizerWebhookModal";
import {IdParam} from "../../../../types";
import {PageBody} from "../../../common/PageBody";
import {PageTitle} from "../../../common/PageTitle";

export default function Webhooks() {
    const {organizerId} = useParams();
    const [createModalOpen, {open: openCreateModal, close: closeCreateModal}] = useDisclosure(false);
    const webhooksQuery = useGetOrganizerWebhooks(organizerId as IdParam);
    const webhooks = webhooksQuery.data?.data?.data;

    return (
        <PageBody>
            <PageTitle
                subheading={t`Send real-time order and attendee data of all your events to your external systems.`}
                actions={(
                    <Button leftSection={<IconPlus size={20}/>} onClick={openCreateModal}>
                        {t`Add Webhook`}
                    </Button>
                )}
            >
                {t`Webhooks`}
            </PageTitle>

            {!webhooks && <Skeleton height={240} radius={32}/>}
            {webhooks && <OrganizerWebhookTable webhooks={webhooks} openCreateModal={openCreateModal}/>}

            {createModalOpen && <CreateOrganizerWebhookModal onClose={closeCreateModal}/>}
        </PageBody>
    );
}
