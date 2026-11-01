import {Anchor, Badge, Group, Paper, Table, Tabs, Text, UnstyledButton} from "@mantine/core";
import {t, Trans} from "@lingui/macro";
import {IconArrowDown, IconBuilding, IconUser} from "@tabler/icons-react";
import {useMemo, useState} from "react";
import {Link} from "react-router";
import dayjs from "dayjs";
import {AssistantUsageByAccount, AssistantUsageByUser} from "../../../../api/admin.client";
import {formatCompact, formatUsd} from "./format";

type AccountSort = 'cost_usd' | 'monthly_rate' | 'turns' | 'cost_per_turn' | 'busiest_day_turns';
type UserSort = 'cost_usd' | 'turns' | 'cost_per_turn';

interface UsageTablesProps {
    accounts: AssistantUsageByAccount[];
    users: AssistantUsageByUser[];
    dailyLimit: number;
}

// eslint-disable-next-line lingui/no-unlocalized-strings
const formatDate = (date: string) => dayjs(date).format('D MMM YYYY, HH:mm');

const SortHeader = <K extends string>({column, label, sort, onSort}: {
    column: K,
    label: string,
    sort: K,
    onSort: (column: K) => void,
}) => (
    <Table.Th ta="right">
        <UnstyledButton onClick={() => onSort(column)} fw={sort === column ? 700 : 500} fz="sm">
            <Group gap={4} justify="flex-end" wrap="nowrap">
                {label}
                {sort === column && <IconArrowDown size={14}/>}
            </Group>
        </UnstyledButton>
    </Table.Th>
);

export const UsageTables = ({accounts, users, dailyLimit}: UsageTablesProps) => {
    const [accountSort, setAccountSort] = useState<AccountSort>('cost_usd');
    const [userSort, setUserSort] = useState<UserSort>('cost_usd');

    const sortedAccounts = useMemo(
        () => [...accounts].sort((a, b) => b[accountSort] - a[accountSort]),
        [accounts, accountSort],
    );
    const sortedUsers = useMemo(
        () => [...users].sort((a, b) => b[userSort] - a[userSort]),
        [users, userSort],
    );

    const empty = (
        <Text c="dimmed" ta="center" p="xl"><Trans>The assistant was not used over this period</Trans></Text>
    );

    return (
        <Paper shadow="sm" radius="md" withBorder>
            <Tabs defaultValue="accounts">
                <Tabs.List px="md" pt="xs">
                    <Tabs.Tab value="accounts" leftSection={<IconBuilding size={16}/>}>
                        {t`By account`} ({accounts.length})
                    </Tabs.Tab>
                    <Tabs.Tab value="users" leftSection={<IconUser size={16}/>}>
                        {t`By person`} ({users.length})
                    </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="accounts">
                    {sortedAccounts.length === 0 ? empty : (
                        <Table.ScrollContainer minWidth={1000}>
                            <Table striped highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>{t`Account`}</Table.Th>
                                        <SortHeader column="turns" label={t`Calls`} sort={accountSort} onSort={setAccountSort}/>
                                        <Table.Th ta="right">{t`People`}</Table.Th>
                                        <Table.Th ta="right">{t`Active days`}</Table.Th>
                                        <SortHeader column="busiest_day_turns" label={t`Busiest day`} sort={accountSort} onSort={setAccountSort}/>
                                        <Table.Th ta="right">{t`Tokens`}</Table.Th>
                                        <SortHeader column="cost_per_turn" label={t`Per call`} sort={accountSort} onSort={setAccountSort}/>
                                        <SortHeader column="cost_usd" label={t`Cost`} sort={accountSort} onSort={setAccountSort}/>
                                        <Table.Th ta="right">{t`% of total`}</Table.Th>
                                        <SortHeader column="monthly_rate" label={t`Monthly pace`} sort={accountSort} onSort={setAccountSort}/>
                                        <Table.Th ta="right">{t`Last call`}</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {sortedAccounts.map(row => (
                                        <Table.Tr key={row.account_id}>
                                            <Table.Td>
                                                <Anchor component={Link} to={`/admin/accounts/${row.account_id}`} fw={500} size="sm">
                                                    {row.account_name}
                                                </Anchor>
                                                <Text size="xs" c="dimmed" lineClamp={1}>
                                                    {row.organizers || row.account_email}
                                                </Text>
                                            </Table.Td>
                                            <Table.Td ta="right">{row.turns.toLocaleString()}</Table.Td>
                                            <Table.Td ta="right">{row.users}</Table.Td>
                                            <Table.Td ta="right">{row.active_days}</Table.Td>
                                            <Table.Td ta="right">
                                                {dailyLimit > 0 && row.busiest_day_turns >= dailyLimit ? (
                                                    <Badge color="red" variant="light">
                                                        {row.busiest_day_turns} / {dailyLimit}
                                                    </Badge>
                                                ) : (
                                                    <>
                                                        {row.busiest_day_turns}
                                                        <Text span size="xs" c="dimmed"> / {dailyLimit}</Text>
                                                    </>
                                                )}
                                            </Table.Td>
                                            <Table.Td ta="right" style={{whiteSpace: 'nowrap'}}>
                                                {formatCompact(row.input_tokens + row.cache_creation_input_tokens + row.cache_read_input_tokens)}
                                                <Text span size="xs" c="dimmed"> + {formatCompact(row.output_tokens)}</Text>
                                            </Table.Td>
                                            <Table.Td ta="right">{formatUsd(row.cost_per_turn)}</Table.Td>
                                            <Table.Td ta="right"><Text fw={600} size="sm">{formatUsd(row.cost_usd)}</Text></Table.Td>
                                            <Table.Td ta="right">{row.share.toLocaleString()} %</Table.Td>
                                            <Table.Td ta="right">{formatUsd(row.monthly_rate)}</Table.Td>
                                            <Table.Td ta="right" style={{whiteSpace: 'nowrap'}}>
                                                <Text size="xs" c="dimmed">{formatDate(row.last_used_at)}</Text>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Table.ScrollContainer>
                    )}
                </Tabs.Panel>

                <Tabs.Panel value="users">
                    {sortedUsers.length === 0 ? empty : (
                        <Table.ScrollContainer minWidth={820}>
                            <Table striped highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>{t`Person`}</Table.Th>
                                        <Table.Th>{t`Account`}</Table.Th>
                                        <SortHeader column="turns" label={t`Calls`} sort={userSort} onSort={setUserSort}/>
                                        <Table.Th ta="right">{t`Active days`}</Table.Th>
                                        <SortHeader column="cost_per_turn" label={t`Per call`} sort={userSort} onSort={setUserSort}/>
                                        <SortHeader column="cost_usd" label={t`Cost`} sort={userSort} onSort={setUserSort}/>
                                        <Table.Th ta="right">{t`Last call`}</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {sortedUsers.map(row => (
                                        <Table.Tr key={`${row.user_id ?? 'deleted'}-${row.account_id}`}>
                                            <Table.Td>
                                                <Text fw={500} size="sm">
                                                    {row.user_id === null
                                                        ? t`Deleted user`
                                                        : [row.first_name, row.last_name].filter(Boolean).join(' ')}
                                                </Text>
                                                {row.email && <Text size="xs" c="dimmed">{row.email}</Text>}
                                            </Table.Td>
                                            <Table.Td>
                                                <Anchor component={Link} to={`/admin/accounts/${row.account_id}`} size="sm">
                                                    {row.account_name}
                                                </Anchor>
                                            </Table.Td>
                                            <Table.Td ta="right">{row.turns.toLocaleString()}</Table.Td>
                                            <Table.Td ta="right">{row.active_days}</Table.Td>
                                            <Table.Td ta="right">{formatUsd(row.cost_per_turn)}</Table.Td>
                                            <Table.Td ta="right"><Text fw={600} size="sm">{formatUsd(row.cost_usd)}</Text></Table.Td>
                                            <Table.Td ta="right" style={{whiteSpace: 'nowrap'}}>
                                                <Text size="xs" c="dimmed">{formatDate(row.last_used_at)}</Text>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Table.ScrollContainer>
                    )}
                </Tabs.Panel>
            </Tabs>
        </Paper>
    );
};
