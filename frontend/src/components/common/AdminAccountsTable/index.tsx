import {ActionIcon, Anchor, Badge, Button, Group, Menu, Table, Text, Tooltip} from "@mantine/core";
import {t} from "@lingui/macro";
import {IconChevronDown, IconChevronRight, IconUserShare} from "@tabler/icons-react";
import {Link, useNavigate} from "react-router";
import {AdminAccount} from "../../../api/admin.client";
import {IdParam} from "../../../types";
import classes from "./AdminAccountsTable.module.scss";

interface AdminAccountsTableProps {
    accounts: AdminAccount[];
    onImpersonate: (userId: IdParam, accountId: IdParam) => void;
    isLoading?: boolean;
}

const tierColor = (tierName?: string) => {
    const name = (tierName ?? '').toLowerCase();
    if (name.includes('premium')) return 'green';
    if (name === 'trusted') return 'blue';
    return 'gray';
};

const formatDate = (dateString?: string) => dateString
    ? new Date(dateString).toLocaleDateString(undefined, {day: 'numeric', month: 'short', year: 'numeric'})
    : '-';

// One line per account: who it is, how far it got, its messaging tier. The whole row opens the
// account; « Impersonate » goes straight into it as its owner (a menu when it has several people).
const AdminAccountsTable = ({accounts, onImpersonate, isLoading}: AdminAccountsTableProps) => {
    const navigate = useNavigate();

    if (!accounts || accounts.length === 0) {
        return (
            <div className={classes.emptyState}>
                <Text size="lg" c="dimmed">{t`No accounts found`}</Text>
            </div>
        );
    }

    return (
        <div className={classes.tableCard}>
            <Table.ScrollContainer minWidth={820}>
                <Table highlightOnHover verticalSpacing="sm" className={classes.table}>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>{t`Account`}</Table.Th>
                            <Table.Th>{t`Owner`}</Table.Th>
                            <Table.Th ta="right">{t`Events`}</Table.Th>
                            <Table.Th ta="right">{t`Users`}</Table.Th>
                            <Table.Th>{t`Messaging Tier`}</Table.Th>
                            <Table.Th>{t`Created`}</Table.Th>
                            <Table.Th/>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {accounts.map((account) => {
                            const people = (account.users ?? []).filter(user => user.role !== 'SUPERADMIN');
                            const owner = people.find(user => user.role === 'ADMIN') ?? people[0];
                            const detailsPath = `/admin/accounts/${account.id}`;

                            return (
                                <Table.Tr key={account.id} className={classes.row}
                                          onClick={() => navigate(detailsPath)}>
                                    <Table.Td>
                                        <Group gap={6} wrap="nowrap">
                                            <Anchor component={Link} to={detailsPath} fw={700} size="sm"
                                                    onClick={(event) => event.stopPropagation()}>
                                                {account.name}
                                            </Anchor>
                                            {account.suspended_at && (
                                                <Badge color="red" size="xs" variant="light">{t`Suspended`}</Badge>
                                            )}
                                        </Group>
                                        <Text size="xs" c="dimmed" lineClamp={1}>{account.email}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        {owner ? (
                                            <>
                                                <Text size="sm" lineClamp={1}>{owner.first_name} {owner.last_name}</Text>
                                                {people.length > 1 && (
                                                    <Text size="xs" c="dimmed">{t`+ ${people.length - 1} more`}</Text>
                                                )}
                                            </>
                                        ) : <Text size="sm" c="dimmed">-</Text>}
                                    </Table.Td>
                                    <Table.Td ta="right">
                                        <Text size="sm" fw={account.events_count > 0 ? 700 : 400}
                                              c={account.events_count > 0 ? undefined : 'dimmed'}>
                                            {account.events_count}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td ta="right"><Text size="sm">{account.users_count}</Text></Table.Td>
                                    <Table.Td>
                                        <Badge size="sm" variant="light" color={tierColor(account.messaging_tier?.name)}>
                                            {account.messaging_tier?.name || t`Untrusted`}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td style={{whiteSpace: 'nowrap'}}>
                                        <Text size="sm" c="dimmed">{formatDate(account.created_at)}</Text>
                                    </Table.Td>
                                    <Table.Td onClick={(event) => event.stopPropagation()}>
                                        <Group gap={4} justify="flex-end" wrap="nowrap">
                                            {people.length === 1 && (
                                                <Button size="xs" variant="light" disabled={isLoading}
                                                        leftSection={<IconUserShare size={14}/>}
                                                        onClick={() => onImpersonate(people[0].id, account.id)}>
                                                    {t`Impersonate`}
                                                </Button>
                                            )}
                                            {people.length > 1 && (
                                                <Menu position="bottom-end" withinPortal>
                                                    <Menu.Target>
                                                        <Button size="xs" variant="light" disabled={isLoading}
                                                                leftSection={<IconUserShare size={14}/>}
                                                                rightSection={<IconChevronDown size={14}/>}>
                                                            {t`Impersonate`}
                                                        </Button>
                                                    </Menu.Target>
                                                    <Menu.Dropdown>
                                                        {people.map(user => (
                                                            <Menu.Item key={user.id}
                                                                       onClick={() => onImpersonate(user.id, account.id)}>
                                                                <Text size="sm">{user.first_name} {user.last_name}</Text>
                                                                <Text size="xs" c="dimmed">{user.email} · {user.role}</Text>
                                                            </Menu.Item>
                                                        ))}
                                                    </Menu.Dropdown>
                                                </Menu>
                                            )}
                                            <Tooltip label={t`View Details`}>
                                                <ActionIcon variant="subtle" component={Link} to={detailsPath}
                                                            aria-label={t`View Details`}>
                                                    <IconChevronRight size={18}/>
                                                </ActionIcon>
                                            </Tooltip>
                                        </Group>
                                    </Table.Td>
                                </Table.Tr>
                            );
                        })}
                    </Table.Tbody>
                </Table>
            </Table.ScrollContainer>
        </div>
    );
};

export default AdminAccountsTable;
