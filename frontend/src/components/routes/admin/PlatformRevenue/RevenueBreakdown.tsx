import {Group, Paper, Select, Table, Tabs, Text, UnstyledButton} from "@mantine/core";
import {t, Trans} from "@lingui/macro";
import {IconArrowDown, IconBuilding, IconCalendarEvent} from "@tabler/icons-react";
import {useMemo, useState} from "react";
import {
    PlatformRevenueBreakdownRow,
    PlatformRevenueByEvent,
    PlatformRevenueByOrganizer,
} from "../../../../api/admin.client";

type SortKey = 'total' | 'contributions' | 'commissions' | 'participation_rate' | 'paid_orders';

interface RevenueBreakdownProps {
    byOrganizer: PlatformRevenueByOrganizer[];
    byEvent: PlatformRevenueByEvent[];
    formatCurrency: (amount: number, currency?: string) => string;
}

const formatPercent = (value: number) => `${value.toLocaleString(undefined, {maximumFractionDigits: 1})} %`;

export const RevenueBreakdown = ({byOrganizer, byEvent, formatCurrency}: RevenueBreakdownProps) => {
    const [sortKey, setSortKey] = useState<SortKey>('total');
    const [organizerId, setOrganizerId] = useState<string | null>(null);

    const sorted = <T extends PlatformRevenueBreakdownRow>(rows: T[]) =>
        [...rows].sort((a, b) => b[sortKey] - a[sortKey]);

    const organizers = useMemo(() => sorted(byOrganizer), [byOrganizer, sortKey]);
    const events = useMemo(
        () => sorted(byEvent.filter(row => !organizerId || String(row.organizer_id) === organizerId)),
        [byEvent, sortKey, organizerId],
    );

    const organizerOptions = useMemo(() => {
        const seen = new Map<string, string>();
        byOrganizer.forEach(row => seen.set(String(row.organizer_id), row.organizer_name));
        return [...seen].map(([value, label]) => ({value, label}));
    }, [byOrganizer]);

    const SortHeader = ({column, label}: { column: SortKey, label: string }) => (
        <Table.Th ta="right">
            <UnstyledButton onClick={() => setSortKey(column)} fw={sortKey === column ? 700 : 500} fz="sm">
                <Group gap={4} justify="flex-end" wrap="nowrap">
                    {label}
                    {sortKey === column && <IconArrowDown size={14}/>}
                </Group>
            </UnstyledButton>
        </Table.Th>
    );

    const metricHeaders = (
        <>
            <SortHeader column="paid_orders" label={t`Paid orders`}/>
            <SortHeader column="participation_rate" label={t`Contribution rate`}/>
            <SortHeader column="contributions" label={t`Contributions`}/>
            <Table.Th ta="right">{t`Average`}</Table.Th>
            <SortHeader column="commissions" label={t`Commissions`}/>
            <SortHeader column="total" label={t`Total`}/>
            <Table.Th ta="right">{t`% of revenue`}</Table.Th>
        </>
    );

    const metricCells = (row: PlatformRevenueBreakdownRow) => (
        <>
            <Table.Td ta="right">{row.paid_orders.toLocaleString()}</Table.Td>
            <Table.Td ta="right">
                {formatPercent(row.participation_rate)}
                <Text span size="xs" c="dimmed"> ({row.contributions_orders})</Text>
            </Table.Td>
            <Table.Td ta="right">{formatCurrency(row.contributions, row.currency)}</Table.Td>
            <Table.Td ta="right">
                {row.contributions_orders > 0 ? formatCurrency(row.average_contribution, row.currency) : '-'}
            </Table.Td>
            <Table.Td ta="right">{formatCurrency(row.commissions, row.currency)}</Table.Td>
            <Table.Td ta="right"><Text fw={600}>{formatCurrency(row.total, row.currency)}</Text></Table.Td>
            <Table.Td ta="right">{formatPercent(row.share)}</Table.Td>
        </>
    );

    const empty = (
        <Text c="dimmed" ta="center" p="xl"><Trans>No paid orders over this period</Trans></Text>
    );

    return (
        <Paper shadow="sm" radius="md" withBorder>
            <Tabs defaultValue="organizers">
                <Tabs.List px="md" pt="xs">
                    <Tabs.Tab value="organizers" leftSection={<IconBuilding size={16}/>}>
                        {t`By organizer`}
                    </Tabs.Tab>
                    <Tabs.Tab value="events" leftSection={<IconCalendarEvent size={16}/>}>
                        {t`By event`}
                    </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="organizers">
                    {organizers.length === 0 ? empty : (
                        <Table.ScrollContainer minWidth={860}>
                            <Table striped highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>{t`Organizer`}</Table.Th>
                                        <Table.Th ta="right">{t`Events`}</Table.Th>
                                        {metricHeaders}
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {organizers.map(row => (
                                        <Table.Tr key={`${row.organizer_id}-${row.currency}`}>
                                            <Table.Td><Text fw={500}>{row.organizer_name}</Text></Table.Td>
                                            <Table.Td ta="right">{row.events_count}</Table.Td>
                                            {metricCells(row)}
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Table.ScrollContainer>
                    )}
                </Tabs.Panel>

                <Tabs.Panel value="events">
                    <Group p="md" pb={0}>
                        <Select
                            data={organizerOptions}
                            value={organizerId}
                            onChange={setOrganizerId}
                            placeholder={t`All organizers`}
                            clearable
                            searchable
                            w={280}
                            aria-label={t`Filter by organizer`}
                        />
                    </Group>
                    {events.length === 0 ? empty : (
                        <Table.ScrollContainer minWidth={860}>
                            <Table striped highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>{t`Event`}</Table.Th>
                                        {metricHeaders}
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {events.map(row => (
                                        <Table.Tr key={`${row.event_id}-${row.currency}`}>
                                            <Table.Td>
                                                <Text fw={500}>{row.event_title}</Text>
                                                <Text size="xs" c="dimmed">{row.organizer_name}</Text>
                                            </Table.Td>
                                            {metricCells(row)}
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
