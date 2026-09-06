import {Badge, Container, Group, Paper, SegmentedControl, SimpleGrid, Skeleton, Stack, Table, Text, Title} from "@mantine/core";
import {t, Trans} from "@lingui/macro";
import {IconCoins, IconHeartHandshake, IconPercentage} from "@tabler/icons-react";
import {useState} from "react";
import dayjs from "dayjs";
import {useGetPlatformRevenue} from "../../../../queries/useGetPlatformRevenue";

const PlatformRevenue = () => {
    const [days, setDays] = useState('30');
    const {data: revenue, isLoading} = useGetPlatformRevenue({days: Number(days), months: 12});

    const formatCurrency = (amount: number, currency?: string) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat().format(num);
    };

    const cards = [
        {
            label: t`Dehors Contributions`,
            icon: <IconHeartHandshake size={32} color="var(--mantine-color-pink-6)"/>,
            recent: revenue?.recent_contributions_total || 0,
            allTime: revenue?.contributions_total || 0,
            orders: revenue?.recent_contributions_orders || 0,
        },
        {
            label: t`Platform Commissions`,
            icon: <IconPercentage size={32} color="var(--mantine-color-indigo-6)"/>,
            recent: revenue?.recent_commissions_total || 0,
            allTime: revenue?.commissions_total || 0,
            orders: null,
        },
        {
            label: t`Total Collected`,
            icon: <IconCoins size={32} color="var(--mantine-color-teal-6)"/>,
            recent: revenue?.recent_total || 0,
            allTime: revenue?.total || 0,
            orders: null,
        },
    ];

    return (
        <Container size="xl" p="xl">
            <Stack gap="xl">
                <div>
                    <Group justify="space-between" align="flex-end" mb="xs" wrap="wrap">
                        <Title order={1}>
                            <Trans>Platform Earnings</Trans>
                        </Title>
                        <SegmentedControl
                            value={days}
                            onChange={setDays}
                            data={[
                                {value: '7', label: t`7 days`},
                                {value: '30', label: t`30 days`},
                                {value: '90', label: t`90 days`},
                            ]}
                        />
                    </Group>
                    <Text size="xs" c="dimmed">
                        <Trans>What the platform actually collected: voluntary Dehors contributions and sales
                            commissions. Approximate totals across all currencies.</Trans>
                    </Text>
                </div>

                <SimpleGrid cols={{base: 1, sm: 3}} spacing="md">
                    {cards.map((card) => (
                        <Paper key={card.label} shadow="sm" p="md" radius="md" withBorder>
                            <Group gap="xs">
                                {card.icon}
                                <div style={{flex: 1}}>
                                    <Text size="xs" c="dimmed" fw={500}>
                                        {card.label}
                                    </Text>
                                    {isLoading ? (
                                        <Skeleton height={28} width={80} mt={4}/>
                                    ) : (
                                        <>
                                            <Text size="xl" fw={700}>
                                                {formatCurrency(card.recent)}
                                            </Text>
                                            <Text size="xs" c="dimmed">
                                                <Trans>All time: {formatCurrency(card.allTime)}</Trans>
                                                {card.orders !== null && (
                                                    <> · <Trans>{formatNumber(card.orders)} orders</Trans></>
                                                )}
                                            </Text>
                                        </>
                                    )}
                                </div>
                            </Group>
                        </Paper>
                    ))}
                </SimpleGrid>

                <div>
                    <Title order={2} mb="md">
                        <Trans>By currency (all time)</Trans>
                    </Title>
                    {isLoading ? (
                        <Skeleton height={160} radius="md"/>
                    ) : revenue?.by_currency && revenue.by_currency.length > 0 ? (
                        <Paper shadow="sm" radius="md" withBorder>
                            <Table striped highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>{t`Currency`}</Table.Th>
                                        <Table.Th ta="right">{t`Contributions`}</Table.Th>
                                        <Table.Th ta="right">{t`Orders`}</Table.Th>
                                        <Table.Th ta="right">{t`Commissions`}</Table.Th>
                                        <Table.Th ta="right">{t`Total`}</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {revenue.by_currency.map((row) => (
                                        <Table.Tr key={row.currency}>
                                            <Table.Td>
                                                <Badge variant="light">{row.currency}</Badge>
                                            </Table.Td>
                                            <Table.Td ta="right">
                                                {formatCurrency(row.contributions, row.currency)}
                                            </Table.Td>
                                            <Table.Td ta="right">{formatNumber(row.contributions_orders)}</Table.Td>
                                            <Table.Td ta="right">
                                                {formatCurrency(row.commissions, row.currency)}
                                            </Table.Td>
                                            <Table.Td ta="right">
                                                <Text fw={600}>{formatCurrency(row.total, row.currency)}</Text>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Paper>
                    ) : (
                        <Paper shadow="sm" p="xl" radius="md" withBorder>
                            <Stack align="center" gap="xs">
                                <IconCoins size={48} color="var(--mantine-color-dimmed)"/>
                                <Text size="lg" c="dimmed">
                                    <Trans>Nothing collected yet</Trans>
                                </Text>
                            </Stack>
                        </Paper>
                    )}
                </div>

                {!isLoading && revenue?.monthly && revenue.monthly.length > 0 && (
                    <div>
                        <Title order={2} mb="md">
                            <Trans>By month</Trans>
                        </Title>
                        <Paper shadow="sm" radius="md" withBorder>
                            <Table striped highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>{t`Month`}</Table.Th>
                                        <Table.Th ta="right">{t`Contributions`}</Table.Th>
                                        <Table.Th ta="right">{t`Commissions`}</Table.Th>
                                        <Table.Th ta="right">{t`Total`}</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {revenue.monthly.map((row) => (
                                        <Table.Tr key={row.month}>
                                            <Table.Td>{dayjs(`${row.month}-01`).format('MMM YYYY')}</Table.Td>
                                            <Table.Td ta="right">{formatCurrency(row.contributions)}</Table.Td>
                                            <Table.Td ta="right">{formatCurrency(row.commissions)}</Table.Td>
                                            <Table.Td ta="right">
                                                <Text fw={600}>{formatCurrency(row.total)}</Text>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Paper>
                    </div>
                )}
            </Stack>
        </Container>
    );
};

export default PlatformRevenue;
