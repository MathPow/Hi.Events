import {useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {t, Trans} from "@lingui/macro";
import {Button, CopyButton, TextInput} from "@mantine/core";
import {IconKey, IconTrash} from "@tabler/icons-react";
import {apiTokenClient, ApiToken, CreatedApiToken} from "../../../../../api/api-token.client.ts";
import {showError, showSuccess} from "../../../../../utilites/notifications.tsx";
import {confirmationDialog} from "../../../../../utilites/confirmationDialog.tsx";
import {prettyDate} from "../../../../../utilites/dates.ts";
import {SettingsCard} from "../SettingsUi.tsx";
import classes from "../Settings.module.scss";

const API_TOKENS_QUERY_KEY = 'apiTokens';

// « Jetons d'API »: another application using the API on the account's behalf. Developers only.
export const ApiTokensCard = () => {
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    // Kept in memory only, while it is copied.
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

    const revoke = (token: ApiToken) => {
        const tokenName = token.name;
        confirmationDialog(
            t`Revoke ${tokenName}? Any application using it will stop working immediately.`,
            () => deleteMutation.mutate(token.id),
            {confirm: t`Revoke`, cancel: t`Cancel`},
        );
    };

    return (
        <SettingsCard
            title={t`API tokens`}
            subtitle={t`Let another application use this API on your behalf, without sharing your password.`}
        >
            {freshToken && (
                <div className={`${classes.notice} ${classes.noticeWarning}`}>
                    <IconKey size={18}/>
                    <div className={classes.cardBody} style={{gap: '0.5rem', flex: 1, minWidth: 0}}>
                        <Trans>Copy this token now. It is shown once and cannot be recovered afterwards.</Trans>
                        <code className={classes.code}>{freshToken.token}</code>
                        <CopyButton value={freshToken.token}>
                            {({copied, copy}) => (
                                <button type="button" className={classes.textButton} onClick={copy}>
                                    {copied ? t`Copied` : t`Copy`}
                                </button>
                            )}
                        </CopyButton>
                    </div>
                </div>
            )}

            <TextInput
                className={classes.field}
                label={t`Token name`}
                description={t`So you can tell them apart later, e.g. dehorsqc.com website`}
                placeholder={t`My other app`}
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
            />
            <Button
                variant="transparent"
                className={classes.outlineButton}
                style={{alignSelf: 'flex-start'}}
                onClick={() => createMutation.mutate()}
                loading={createMutation.isPending}
                disabled={name.trim() === ''}
            >
                {t`Create token`}
            </Button>

            <div className={classes.list}>
                {tokensQuery.data?.length === 0 && <p className={classes.empty}>{t`No tokens yet.`}</p>}
                {tokensQuery.data?.map(token => (
                    <div key={token.id} className={classes.listRow}>
                        <span className={classes.listRowText}>
                            <span className={classes.listRowTitle}>{token.name}</span>
                            <span className={classes.listRowHint}>
                                {t`Created`} {prettyDate(token.created_at, 'UTC')} · {t`Last used`} {token.last_used_at ? prettyDate(token.last_used_at, 'UTC') : t`Never`}
                            </span>
                        </span>
                        <button type="button" className={classes.iconButton} aria-label={t`Revoke`} title={t`Revoke`}
                                onClick={() => revoke(token)}>
                            <IconTrash size={18} color="#c8442f"/>
                        </button>
                    </div>
                ))}
            </div>
        </SettingsCard>
    );
};
