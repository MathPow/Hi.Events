import {ReactNode, useState} from "react";
import {ActionIcon, Button, Popover, Tooltip} from "@mantine/core";
import {IconBolt, IconClipboardList, IconDotsVertical, IconPencil, IconPlus, IconTrash} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import {IdParam, Webhook} from "../../../types.ts";
import {relativeDate} from "../../../utilites/dates.ts";
import {confirmationDialog} from "../../../utilites/confirmationDialog.tsx";
import {ActionMenu} from "../ActionMenu";
import {NoResultsSplash} from "../NoResultsSplash";
import classes from "./WebhookTable.module.scss";

interface WebhookListProps {
    webhooks: Webhook[];
    openCreateModal: () => void;
    onDelete: (webhookId: IdParam) => void;
    editModal: (webhookId: IdParam, onClose: () => void) => ReactNode;
    logsModal: (webhookId: IdParam, onClose: () => void) => ReactNode;
}

const EventTypes = ({webhook}: { webhook: Webhook }) => {
    const types = webhook.event_types ?? [];
    if (types.length === 0) {
        return <span className={classes.muted}>—</span>;
    }
    if (types.length === 1) {
        return <code className={classes.eventType}>{types[0]}</code>;
    }
    const eventCount = types.length;
    return (
        <Tooltip label={<span className={classes.tooltipList}>{types.map(type => <span key={type}>{type}</span>)}</span>}>
            <span className={classes.eventType} tabIndex={0}>{t`${eventCount} events`}</span>
        </Tooltip>
    );
};

const LastResponse = ({webhook}: { webhook: Webhook }) => {
    const code = webhook.last_response_code;
    if (code === null || code === undefined) {
        return <span className={classes.muted}>{t`No responses yet`}</span>;
    }
    const isSuccess = code >= 200 && code < 300;

    return (
        <Popover width={360} position="bottom-start" withArrow shadow="md">
            <Popover.Target>
                <button type="button" className={classes.tag} data-tone={isSuccess ? 'ok' : 'problem'}>
                    <IconBolt size={12}/>
                    {isSuccess ? t`Success` : t`Error`}{code > 0 ? ` · ${code}` : ''}
                </button>
            </Popover.Target>
            <Popover.Dropdown>
                <div className={classes.response}>
                    <span className={classes.responseTitle}>
                        {t`Response Details`} · {code > 0 ? code : t`No response`}
                    </span>
                    {webhook.last_response_body && <pre className={classes.responseBody}>{webhook.last_response_body}</pre>}
                </div>
            </Popover.Dropdown>
        </Popover>
    );
};

/**
 * The webhooks of an event or an organizer, like the tables of the event pages: a pale header row on
 * desktop, a card per webhook on phones. The modals and the deletion come from the page.
 */
export const WebhookList = ({webhooks, openCreateModal, onDelete, editModal, logsModal}: WebhookListProps) => {
    const [editing, setEditing] = useState<IdParam | null>(null);
    const [viewingLogs, setViewingLogs] = useState<IdParam | null>(null);

    if (webhooks.length === 0) {
        return (
            <NoResultsSplash
                heading={t`No Webhooks`}
                icon="globe"
                subHeading={t`A webhook notifies another service (a CRM, a mailing list, Zapier, Make…) as soon as an order or an attendee is created or changes.`}
            >
                <Button leftSection={<IconPlus size={20}/>} onClick={openCreateModal}>{t`Add Webhook`}</Button>
            </NoResultsSplash>
        );
    }

    return (
        <>
            <div className={classes.table} role="table" aria-label={t`Webhooks`}>
                <div className={classes.head} role="row">
                    <span role="columnheader">{t`URL`}</span>
                    <span role="columnheader">{t`Event Types`}</span>
                    <span role="columnheader">{t`Status`}</span>
                    <span role="columnheader">{t`Last Response`}</span>
                    <span role="columnheader">{t`Last Triggered`}</span>
                    <span role="columnheader" aria-label={t`Actions`}/>
                </div>
                {webhooks.map(webhook => (
                    <div key={webhook.id} className={classes.row} role="row">
                        <span role="cell" className={classes.url} title={webhook.url}>{webhook.url}</span>
                        <span role="cell" className={classes.cell} data-label={t`Event Types`}><EventTypes webhook={webhook}/></span>
                        <span role="cell" className={classes.cell} data-label={t`Status`}>
                            <span className={classes.tag} data-tone={webhook.status === 'ENABLED' ? 'ok' : 'neutral'}>
                                {webhook.status === 'ENABLED' ? t`Enabled` : t`Paused`}
                            </span>
                        </span>
                        <span role="cell" className={classes.cell} data-label={t`Last Response`}><LastResponse webhook={webhook}/></span>
                        <span role="cell" className={classes.cell} data-label={t`Last Triggered`}
                              title={webhook.last_triggered_at ? String(webhook.last_triggered_at) : undefined}>
                            {webhook.last_triggered_at ? relativeDate(webhook.last_triggered_at as string) : t`Never`}
                        </span>
                        <span role="cell" className={classes.menu}>
                            <ActionMenu
                                target={(
                                    <ActionIcon variant="subtle" className={classes.roundButton} aria-label={t`Actions`}>
                                        <IconDotsVertical size={20}/>
                                    </ActionIcon>
                                )}
                                itemsGroups={[
                                    {
                                        label: t`Manage`,
                                        items: [
                                            {label: t`Edit webhook`, icon: <IconPencil size={14}/>, onClick: () => setEditing(webhook.id)},
                                            {label: t`View logs`, icon: <IconClipboardList size={14}/>, onClick: () => setViewingLogs(webhook.id)},
                                        ],
                                    },
                                    {
                                        label: t`Danger zone`,
                                        showDividerAbove: true,
                                        items: [{
                                            label: t`Delete webhook`,
                                            icon: <IconTrash size={14}/>,
                                            color: 'red',
                                            onClick: () => confirmationDialog(
                                                t`Are you sure you want to delete this webhook?`,
                                                () => onDelete(webhook.id),
                                            ),
                                        }],
                                    },
                                ]}
                            />
                        </span>
                    </div>
                ))}
            </div>

            {viewingLogs !== null && logsModal(viewingLogs, () => setViewingLogs(null))}
            {editing !== null && editModal(editing, () => setEditing(null))}
        </>
    );
};
