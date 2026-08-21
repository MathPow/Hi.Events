import {useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {ActionIcon, Alert, Button, Code, CopyButton, Group, Table, TextInput, Tooltip} from "@mantine/core";
import {IconCheck, IconCopy, IconKey, IconTrash} from "@tabler/icons-react";
import {t, Trans} from "@lingui/macro";
import {Card} from "../../../../../common/Card";
import {HeadingWithDescription} from "../../../../../common/Card/CardHeading";
import {apiTokenClient, ApiToken, CreatedApiToken} from "../../../../../../api/api-token.client.ts";
import {showError, showSuccess} from "../../../../../../utilites/notifications.tsx";
import {confirmationDialog} from "../../../../../../utilites/confirmationDialog.tsx";
import {prettyDate} from "../../../../../../utilites/dates.ts";

const API_TOKENS_QUERY_KEY = 'apiTokens';

export const ApiTokens = () => {
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    // Conserve en memoire uniquement, le temps que l'utilisateur le copie.
    const [freshToken, setFreshToken] = useState<CreatedApiToken | null>(null);

    const tokensQuery = useQuery({
        queryKey: [API_TOKENS_QUERY_KEY],
        queryFn: async () => (await apiTokenClient.all()).data,
    });

    const createMutation = useMutation({
        mutationFn: () => apiTokenClient.create({name}),
        onSuccess: (response) => {
            setFreshToken(response.data);
            setName('');
            queryClient.invalidateQueries({queryKey: [API_TOKENS_QUERY_KEY]});
        },
        onError: () => showError(t`Could not create the token. Please try again.`),
    });

    const deleteMutation = useMutation({
        mutationFn: (tokenId: number) => apiTokenClient.delete(tokenId),
        onSuccess: () => {
            showSuccess(t`Token revoked`);
            queryClient.invalidateQueries({queryKey: [API_TOKENS_QUERY_KEY]});
        },
        onError: () => showError(t`Could not revoke the token. Please try again.`),
    });

    const handleDelete = (token: ApiToken) => {
        confirmationDialog(
            t`Revoke ${token.name}? Any application using it will stop working immediately.`,
            () => deleteMutation.mutate(token.id),
        );
    };

    return (
        <Card>
            <HeadingWithDescription
                heading={t`API tokens`}
                description={t`Let another application use this API on your behalf, without sharing your password.`}
            />

            {freshToken && (
                <Alert icon={<IconKey size={18}/>} color="orange" mb={20}>
                    <Trans>
                        Copy this token now. It is shown once and cannot be recovered afterwards.
                    </Trans>
                    <Group mt={10} wrap="nowrap">
                        <Code style={{wordBreak: 'break-all', flex: 1}}>{freshToken.token}</Code>
                        <CopyButton value={freshToken.token}>
                            {({copied, copy}) => (
                                <Button size="xs" onClick={copy} leftSection={copied ? <IconCheck size={14}/> : <IconCopy size={14}/>}>
                                    {copied ? t`Copied` : t`Copy`}
                                </Button>
                            )}
                        </CopyButton>
                    </Group>
                </Alert>
            )}

            <Group align="flex-end" mb={20}>
                <TextInput
                    style={{flex: 1}}
                    label={t`Token name`}
                    description={t`So you can tell them apart later, e.g. dehorsqc.com website`}
                    value={name}
                    onChange={(event) => setName(event.currentTarget.value)}
                    placeholder={t`My other app`}
                />
                <Button
                    onClick={() => createMutation.mutate()}
                    loading={createMutation.isPending}
                    disabled={name.trim() === ''}
                >
                    {t`Create token`}
                </Button>
            </Group>

            <Table>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>{t`Name`}</Table.Th>
                        <Table.Th>{t`Created`}</Table.Th>
                        <Table.Th>{t`Last used`}</Table.Th>
                        <Table.Th/>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {tokensQuery.data?.length === 0 && (
                        <Table.Tr>
                            <Table.Td colSpan={4}>{t`No tokens yet.`}</Table.Td>
                        </Table.Tr>
                    )}
                    {tokensQuery.data?.map((token) => (
                        <Table.Tr key={token.id}>
                            <Table.Td>{token.name}</Table.Td>
                            <Table.Td>{prettyDate(token.created_at, 'UTC')}</Table.Td>
                            <Table.Td>{token.last_used_at ? prettyDate(token.last_used_at, 'UTC') : t`Never`}</Table.Td>
                            <Table.Td align="right">
                                <Tooltip label={t`Revoke`}>
                                    <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(token)}>
                                        <IconTrash size={16}/>
                                    </ActionIcon>
                                </Tooltip>
                            </Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        </Card>
    );
};

export default ApiTokens;
