import {useState} from "react";
import {t} from "@lingui/macro";
import {Button, Menu} from "@mantine/core";
import {IconDotsVertical, IconPencil, IconSend, IconX} from "@tabler/icons-react";
import {User} from "../../../../../types.ts";
import {useGetUsers} from "../../../../../queries/useGetUsers.ts";
import {useResendUserInvitation} from "../../../../../mutations/useResendUserInvitation.ts";
import {useDeleteUserInvitation} from "../../../../../mutations/useDeleteUserInvitation.ts";
import {getInitials} from "../../../../../utilites/helpers.ts";
import {relativeDate} from "../../../../../utilites/dates.ts";
import {showError, showSuccess} from "../../../../../utilites/notifications.tsx";
import {InviteUserModal} from "../../../../modals/InviteUserModal";
import {EditUserModal} from "../../../../modals/EditUserModal";
import {SettingsCard, Tag} from "../SettingsUi.tsx";
import classes from "../Settings.module.scss";

const roleLabel = (role?: User['role']) => role === 'ORGANIZER' ? t`Organizer` : t`Admin`;

const lastLogin = (user: User) => {
    const when = user.last_login_at ? relativeDate(user.last_login_at) : t`Never`;
    return t`Last login: ${when}`;
};

// « Membres de l'équipe »: who can sign in to this account, and with which role. Administrators only.
export const MembersCard = () => {
    const usersQuery = useGetUsers();
    const resendMutation = useResendUserInvitation();
    const revokeMutation = useDeleteUserInvitation();
    const [inviting, setInviting] = useState(false);
    const [editing, setEditing] = useState<User | null>(null);
    const users = usersQuery.data?.data ?? [];

    const resend = (user: User) => resendMutation.mutate({userId: user.id}, {
        onSuccess: () => showSuccess(t`Invitation resent!`),
        onError: () => showError(t`Something went wrong! Please try again`),
    });

    const revoke = (user: User) => revokeMutation.mutate({userId: user.id}, {
        onSuccess: () => showSuccess(t`Invitation revoked!`),
        onError: () => showError(t`Something went wrong! Please try again`),
    });

    return (
        <SettingsCard
            full
            title={t`Team members`}
            subtitle={t`An Administrator has access to everything; an Organizer manages the events and the tickets.`}
            action={(
                <Button variant="transparent" className={classes.inkButton} onClick={() => setInviting(true)}>
                    {t`Invite User`}
                </Button>
            )}
        >
            <div className={classes.list}>
                {users.map(user => (
                    <div key={user.id} className={classes.listRow}>
                        <span className={classes.avatar}>{getInitials(`${user.first_name} ${user.last_name}`)}</span>
                        <span className={classes.listRowText}>
                            <span className={classes.listRowTitle}>{user.first_name} {user.last_name}</span>
                            <span className={classes.listRowHint}>
                                {user.email} · {lastLogin(user)}
                            </span>
                        </span>
                        {user.status === 'INVITED' && <Tag tone="yellow">{t`Invited`}</Tag>}
                        {user.status === 'INACTIVE' && <Tag tone="neutral">{t`Inactive`}</Tag>}
                        <Tag tone={user.role === 'ORGANIZER' ? 'neutral' : 'ink'}>{roleLabel(user.role)}</Tag>
                        <Menu position="bottom-end" withinPortal>
                            <Menu.Target>
                                <button type="button" className={classes.iconButton} aria-label={t`Actions`}>
                                    <IconDotsVertical size={18}/>
                                </button>
                            </Menu.Target>
                            <Menu.Dropdown>
                                <Menu.Item leftSection={<IconPencil size={16}/>} onClick={() => setEditing(user)}>
                                    {t`Edit user`}
                                </Menu.Item>
                                {user.status === 'INVITED' && (
                                    <>
                                        <Menu.Item leftSection={<IconSend size={16}/>} onClick={() => resend(user)}>
                                            {t`Resend invitation`}
                                        </Menu.Item>
                                        <Menu.Item color="red" leftSection={<IconX size={16}/>} onClick={() => revoke(user)}>
                                            {t`Revoke invitation`}
                                        </Menu.Item>
                                    </>
                                )}
                            </Menu.Dropdown>
                        </Menu>
                    </div>
                ))}
            </div>

            {inviting && <InviteUserModal onClose={() => setInviting(false)}/>}
            {editing && <EditUserModal user={editing} onClose={() => setEditing(null)}/>}
        </SettingsCard>
    );
};
