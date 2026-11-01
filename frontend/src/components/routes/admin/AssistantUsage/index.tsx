import {Container, Group, Paper, SegmentedControl, SimpleGrid, Skeleton, Stack, Text, Title} from "@mantine/core";
import {BarChart} from "@mantine/charts";
import {t, Trans} from "@lingui/macro";
import {IconBuildingBank, IconCoins, IconMessages, IconStack2} from "@tabler/icons-react";
import {useState} from "react";
import dayjs from "dayjs";
import {useGetAssistantUsage} from "../../../../queries/useGetAssistantUsage";
import {UsageTables} from "./UsageTables";
import {formatCompact, formatUsd} from "./format";

// What the organizers' assistant costs the platform: Anthropic bills each call, in US dollars.
const AssistantUsage = () => {
    const [days, setDays] = useState('30');
    const {data: usage, isLoading, isFetching} = useGetAssistantUsage(Number(days));
    const totals = usage?.totals;

    const prompt = totals
        ? totals.input_tokens + totals.cache_creation_input_tokens + totals.cache_read_input_tokens
        : 0;
    const cacheShare = prompt > 0 && totals ? Math.round(totals.cache_read_input_tokens / prompt * 100) : 0;
    const monthly = formatUsd(totals?.monthly_rate ?? 0);
    const perCall = formatUsd(totals?.cost_per_turn ?? 0);
    const people = totals?.users ?? 0;
    const written = formatCompact(totals?.output_tokens ?? 0);
    const model = usage?.model ?? '…';
    const limit = usage?.daily_limit ?? '…';

    const cards = [
        {
            label: t`Cost`,
            icon: <IconCoins size={32} color="var(--mantine-color-orange-6)"/>,
            value: formatUsd(totals?.cost_usd ?? 0),
            detail: t`About ${monthly} per month at this pace`,
        },
        {
            label: t`Calls`,
            icon: <IconMessages size={32} color="var(--mantine-color-indigo-6)"/>,
            value: (totals?.turns ?? 0).toLocaleString(),
            detail: t`${perCall} per call on average`,
        },
        {
            label: t`Accounts`,
            icon: <IconBuildingBank size={32} color="var(--mantine-color-teal-6)"/>,
            value: (totals?.accounts ?? 0).toLocaleString(),
            detail: t`${people} people`,
        },
        {
            label: t`Tokens`,
            icon: <IconStack2 size={32} color="var(--mantine-color-grape-6)"/>,
            value: formatCompact(prompt + (totals?.output_tokens ?? 0)),
            detail: t`${written} written · ${cacheShare} % of input read from cache`,
        },
    ];

    return (
        <Container size="xl" px={{base: 0, sm: 'xl'}} py="xl">
            <Stack gap="xl">
                <div>
                    <Group justify="space-between" align="flex-end" mb="xs" wrap="wrap">
                        <Title order={1}>
                            <Trans>Assistant usage</Trans>
                        </Title>
                        <SegmentedControl
                            value={days}
                            onChange={setDays}
                            data={[
                                {value: '7', label: t`7 days`},
                                {value: '30', label: t`30 days`},
                                {value: '90', label: t`90 days`},
                                {value: '0', label: t`All time`},
                            ]}
                        />
                    </Group>
                    <Text size="xs" c="dimmed">
                        <Trans>
                            What the assistant costs the platform, estimated from Anthropic's public prices in US
                            dollars. A call is one answer from the model: a question that reads the event first
                            takes two or more. Model: {model} · limit of {limit} calls
                            per account per day.
                        </Trans>
                    </Text>
                </div>

                <SimpleGrid cols={{base: 1, xs: 2, md: 4}} spacing="md">
                    {cards.map((card) => (
                        <Paper key={card.label} shadow="sm" p="md" radius="md" withBorder>
                            <Group gap="xs" wrap="nowrap" align="flex-start">
                                {card.icon}
                                <div style={{flex: 1, minWidth: 0}}>
                                    <Text size="xs" c="dimmed" fw={500}>{card.label}</Text>
                                    {isLoading ? (
                                        <Skeleton height={28} width={80} mt={4}/>
                                    ) : (
                                        <>
                                            <Text size="xl" fw={700}>{card.value}</Text>
                                            <Text size="xs" c="dimmed">{card.detail}</Text>
                                        </>
                                    )}
                                </div>
                            </Group>
                        </Paper>
                    ))}
                </SimpleGrid>

                <Paper shadow="sm" p="md" radius="md" withBorder style={{opacity: isFetching ? 0.6 : 1}}>
                    <Title order={2} size="h4" mb="md">
                        <Trans>Cost per day</Trans>
                    </Title>
                    {isLoading ? (
                        <Skeleton height={220} radius="md"/>
                    ) : (
                        <BarChart
                            h={220}
                            data={(usage?.daily ?? []).map(day => ({
                                day: dayjs(day.day).format('D MMM'),
                                cost: day.cost_usd,
                                turns: day.turns,
                            }))}
                            dataKey="day"
                            series={[{name: 'cost', label: t`Cost`, color: '#fa7853'}]}
                            valueFormatter={(value) => formatUsd(value)}
                            tickLine="none"
                            gridAxis="y"
                        />
                    )}
                </Paper>

                <div>
                    <Title order={2} mb={4}>
                        <Trans>Who costs the most</Trans>
                    </Title>
                    <Text size="xs" c="dimmed" mb="md">
                        <Trans>
                            Monthly pace: the cost over 30 days at the same rhythm, counted from the first call of the
                            period. Busiest day: the most calls in one day, next to the daily limit. Click a column to
                            sort.
                        </Trans>
                    </Text>
                    {isLoading ? (
                        <Skeleton height={240} radius="md"/>
                    ) : (
                        <UsageTables
                            accounts={usage?.accounts ?? []}
                            users={usage?.users ?? []}
                            dailyLimit={usage?.daily_limit ?? 0}
                        />
                    )}
                </div>
            </Stack>
        </Container>
    );
};

export default AssistantUsage;
