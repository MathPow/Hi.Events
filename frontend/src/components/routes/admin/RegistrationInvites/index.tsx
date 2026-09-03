import {
    ActionIcon,
    Alert,
    Badge,
    Button,
    Card,
    Container,
    CopyButton,
    Group,
    NumberInput,
    Skeleton,
    Stack,
    Text,
    TextInput,
    Title,
} from "@mantine/core";
import {t} from "@lingui/macro";
import {useForm} from "@mantine/form";
import {useState} from "react";
import {IconCheck, IconCopy, IconInfoCircle, IconPlus, IconTrash} from "@tabler/icons-react";
import {Modal} from "../../../common/Modal";
import {useGetRegistrationInvites} from "../../../../queries/useGetRegistrationInvites";
import {useCreateRegistrationInvite} from "../../../../mutations/useCreateRegistrationInvite";
import {useRevokeRegistrationInvite} from "../../../../mutations/useRevokeRegistrationInvite";
import {CreatedRegistrationInvite, RegistrationInvite, RegistrationInviteStatus} from "../../../../api/admin.client";
import {showError, showSuccess} from "../../../../utilites/notifications";
import {useFormErrorResponseHandler} from "../../../../hooks/useFormErrorResponseHandler";
import {prettyDate} from "../../../../utilites/dates";
import classes from "./RegistrationInvites.module.scss";

interface InviteFormValues {
    email: string;
    label: string;
    expires_in_days: number | string;
}

const statusColour: Record<RegistrationInviteStatus, string> = {
    PENDING: 'green',
    USED: 'blue',
    EXPIRED: 'gray',
    REVOKED: 'red',
};

const statusLabel = (status: RegistrationInviteStatus): string => {
    switch (status) {
        case 'USED':
            return t`Used`;
        case 'EXPIRED':
            return t`Expired`;
        case 'REVOKED':
            return t`Revoked`;
        default:
            return t`Ready to use`;
    }
};

const RegistrationInvites = () => {
    const {data: invitesData, isLoading} = useGetRegistrationInvites();
    const revokeMutation = useRevokeRegistrationInvite();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createdInvite, setCreatedInvite] = useState<CreatedRegistrationInvite | null>(null);

    const invites = invitesData?.data || [];

    const handleRevoke = (invite: RegistrationInvite) => {
        if (!window.confirm(t`Revoke this invitation? The link will stop working immediately.`)) {
            return;
        }

        revokeMutation.mutate(invite.id, {
            onSuccess: () => showSuccess(t`Invitation revoked`),
            onError: () => showError(t`Failed to revoke the invitation`),
        });
    };

    if (isLoading) {
        return (
            <Container size="xl" p="xl">
                <Stack gap="lg">
                    <Skeleton height={40} width={260}/>
                    <Skeleton height={120} radius="md"/>
                    <Skeleton height={120} radius="md"/>
                </Stack>
            </Container>
        );
    }

    return (
        <>
            <Container size="xl" p="xl">
                <Stack gap="lg">
                    <Group justify="space-between">
                        <Title order={1}>{t`Registration Invitations`}</Title>
                        <Button
                            leftSection={<IconPlus size={16}/>}
                            onClick={() => setShowCreateModal(true)}
                        >
                            {t`Create invitation`}
                        </Button>
                    </Group>

                    <Alert icon={<IconInfoCircle size={16}/>} color="blue">
                        {t`Each link creates one account and then stops working, even while public registration is closed. The link is only shown once, when you create it.`}
                    </Alert>

                    <Stack gap="md">
                        {invites.map((invite) => (
                            <Card key={invite.id} className={classes.inviteCard}>
                                <Group justify="space-between" align="flex-start">
                                    <Stack gap="xs">
                                        <Group gap="sm">
                                            <Text fw={600}>
                                                {invite.email || t`Anyone with the link`}
                                            </Text>
                                            <Badge color={statusColour[invite.status]} size="sm">
                                                {statusLabel(invite.status)}
                                            </Badge>
                                        </Group>

                                        {invite.label && (
                                            <Text size="sm" c="dimmed">{invite.label}</Text>
                                        )}

                                        <Group gap="xl">
                                            <div>
                                                <Text size="xs" c="dimmed">{t`Created`}</Text>
                                                <Text size="sm">{prettyDate(invite.created_at, 'UTC')}</Text>
                                            </div>
                                            <div>
                                                <Text size="xs" c="dimmed">{t`Expires`}</Text>
                                                <Text size="sm">
                                                    {invite.expires_at
                                                        ? prettyDate(invite.expires_at, 'UTC')
                                                        : t`Never`}
                                                </Text>
                                            </div>
                                            {invite.used_at && (
                                                <div>
                                                    <Text size="xs" c="dimmed">{t`Used`}</Text>
                                                    <Text size="sm">{prettyDate(invite.used_at, 'UTC')}</Text>
                                                </div>
                                            )}
                                        </Group>
                                    </Stack>

                                    {invite.status === 'PENDING' && (
                                        <ActionIcon
                                            variant="light"
                                            color="red"
                                            onClick={() => handleRevoke(invite)}
                                            aria-label={t`Revoke invitation`}
                                        >
                                            <IconTrash size={16}/>
                                        </ActionIcon>
                                    )}
                                </Group>
                            </Card>
                        ))}

                        {invites.length === 0 && (
                            <Text c="dimmed" ta="center">{t`No invitations yet`}</Text>
                        )}
                    </Stack>
                </Stack>
            </Container>

            {showCreateModal && (
                <CreateInviteModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={(invite) => {
                        setShowCreateModal(false);
                        setCreatedInvite(invite);
                    }}
                />
            )}

            {createdInvite && (
                <InviteLinkModal
                    invite={createdInvite}
                    onClose={() => setCreatedInvite(null)}
                />
            )}
        </>
    );
};

interface CreateInviteModalProps {
    onClose: () => void;
    onCreated: (invite: CreatedRegistrationInvite) => void;
}

const CreateInviteModal = ({onClose, onCreated}: CreateInviteModalProps) => {
    const createMutation = useCreateRegistrationInvite();
    const errorHandler = useFormErrorResponseHandler();

    const form = useForm<InviteFormValues>({
        initialValues: {
            email: '',
            label: '',
            expires_in_days: 14,
        },
    });

    const handleSubmit = (values: InviteFormValues) => {
        createMutation.mutate({
            email: values.email.trim() || null,
            label: values.label.trim() || null,
            expires_in_days: values.expires_in_days === '' ? null : Number(values.expires_in_days),
        }, {
            onSuccess: (response) => onCreated(response.data),
            onError: (error: any) => errorHandler(form, error),
        });
    };

    return (
        <Modal opened onClose={onClose} heading={t`Create invitation`}>
            <form onSubmit={form.onSubmit(handleSubmit)}>
                <Stack gap="md">
                    <TextInput
                        {...form.getInputProps('email')}
                        label={t`Email address`}
                        placeholder={'someone@example.com'}
                        description={t`Optional. When set, only this address can use the link.`}
                    />
                    <TextInput
                        {...form.getInputProps('label')}
                        label={t`Note`}
                        placeholder={t`Who is this for?`}
                        description={t`Optional. Only visible to you, to recognise the invitation later.`}
                    />
                    <NumberInput
                        {...form.getInputProps('expires_in_days')}
                        label={t`Expires after (days)`}
                        min={1}
                        max={365}
                        allowDecimal={false}
                        description={t`Leave empty for a link that never expires.`}
                    />
                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={onClose} type="button">
                            {t`Cancel`}
                        </Button>
                        <Button type="submit" loading={createMutation.isPending}>
                            {t`Create invitation`}
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Modal>
    );
};

interface InviteLinkModalProps {
    invite: CreatedRegistrationInvite;
    onClose: () => void;
}

const InviteLinkModal = ({invite, onClose}: InviteLinkModalProps) => {
    return (
        <Modal opened onClose={onClose} heading={t`Invitation link`}>
            <Stack gap="md">
                <Alert icon={<IconInfoCircle size={16}/>} color="yellow">
                    {t`Copy this link now. It is not stored and cannot be shown again.`}
                </Alert>

                <TextInput
                    readOnly
                    value={invite.registration_url}
                    onFocus={(event) => event.currentTarget.select()}
                    rightSection={
                        <CopyButton value={invite.registration_url}>
                            {({copied, copy}) => (
                                <ActionIcon
                                    variant="subtle"
                                    color={copied ? 'green' : 'gray'}
                                    onClick={copy}
                                    aria-label={t`Copy link`}
                                >
                                    {copied ? <IconCheck size={16}/> : <IconCopy size={16}/>}
                                </ActionIcon>
                            )}
                        </CopyButton>
                    }
                />

                {invite.email && (
                    <Text size="sm" c="dimmed">
                        {t`Only ${invite.email} can use this link.`}
                    </Text>
                )}

                <Group justify="flex-end">
                    <Button onClick={onClose}>{t`Done`}</Button>
                </Group>
            </Stack>
        </Modal>
    );
};

export default RegistrationInvites;
