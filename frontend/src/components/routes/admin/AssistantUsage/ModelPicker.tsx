import {Badge, Group, Paper, Radio, SimpleGrid, Stack, Text, Title} from "@mantine/core";
import {t, Trans} from "@lingui/macro";
import {AssistantModelOption, AssistantUsageTotals} from "../../../../api/admin.client";
import {useUpdateAssistantModel} from "../../../../mutations/useUpdateAssistantModel";
import {showError, showSuccess} from "../../../../utilites/notifications";
import {formatUsd} from "./format";

interface ModelPickerProps {
    models: AssistantModelOption[];
    current: string;
    totals?: AssistantUsageTotals;
}

// The period's tokens at another model's prices: a rough idea of what it would have cost
// (5-minute cache writes, as the assistant asks for).
const costWith = (model: AssistantModelOption, totals: AssistantUsageTotals) => (
    totals.input_tokens * model.input
    + totals.cache_creation_input_tokens * model.input * 1.25
    + totals.cache_read_input_tokens * model.cache_read
    + totals.output_tokens * model.output
) / 1_000_000;

// The model the assistant runs on, for every account.
export const ModelPicker = ({models, current, totals}: ModelPickerProps) => {
    const updateModel = useUpdateAssistantModel();
    const hasUsage = !!totals && totals.turns > 0;

    const choose = (model: string) => {
        if (model === current) {
            return;
        }
        updateModel.mutate(model, {
            onSuccess: () => showSuccess(t`Model changed`),
            onError: () => showError(t`Could not change the model`),
        });
    };

    return (
        <Paper shadow="sm" p="md" radius="md" withBorder>
            <Title order={2} size="h4" mb={4}>
                <Trans>Assistant model</Trans>
            </Title>
            <Text size="xs" c="dimmed" mb="md">
                <Trans>
                    For every account, from their next message. Changing the model empties the prompt cache: the
                    first calls cost a little more. Prices in US dollars per million tokens.
                </Trans>
            </Text>
            <Radio.Group value={current} onChange={choose}>
                <SimpleGrid cols={{base: 1, xs: 2, md: 4}} spacing="sm">
                    {models.map((model) => {
                        const input = formatUsd(model.input);
                        const output = formatUsd(model.output);
                        const estimate = hasUsage ? formatUsd(costWith(model, totals!)) : null;

                        return (
                            <Radio.Card key={model.id} value={model.id} radius="md" p="sm"
                                        disabled={updateModel.isPending}
                                        style={{opacity: updateModel.isPending ? 0.6 : 1}}>
                                <Group wrap="nowrap" align="flex-start" gap="sm">
                                    <Radio.Indicator mt={2}/>
                                    <Stack gap={2}>
                                        <Group gap={6}>
                                            <Text fw={700} size="sm">{model.label}</Text>
                                            {model.id === current && (
                                                <Badge size="xs" color="orange" variant="light">{t`Current`}</Badge>
                                            )}
                                        </Group>
                                        <Text size="xs" c="dimmed">{t`${input} in · ${output} out`}</Text>
                                        {estimate && (
                                            <Text size="xs">{t`≈ ${estimate} for this period`}</Text>
                                        )}
                                    </Stack>
                                </Group>
                            </Radio.Card>
                        );
                    })}
                </SimpleGrid>
            </Radio.Group>
        </Paper>
    );
};
