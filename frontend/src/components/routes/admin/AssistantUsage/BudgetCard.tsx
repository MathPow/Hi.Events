import {Anchor, Button, Group, NumberInput, Paper, Text, Title} from "@mantine/core";
import {t, Trans} from "@lingui/macro";
import {useEffect, useState} from "react";
import {useUpdateAssistantBudget} from "../../../../mutations/useUpdateAssistantBudget";
import {showError, showSuccess} from "../../../../utilites/notifications";
import {formatUsd} from "./format";

interface BudgetCardProps {
    budget: number;
    defaultBudget: number;
}

// What the assistant may cost each account per week, for every account.
export const BudgetCard = ({budget, defaultBudget}: BudgetCardProps) => {
    const updateBudget = useUpdateAssistantBudget();
    const [value, setValue] = useState<number | string>(budget);

    useEffect(() => setValue(budget), [budget]);

    const save = (next: number | null) => updateBudget.mutate(next, {
        onSuccess: () => showSuccess(t`Budget changed`),
        onError: () => showError(t`Could not change the budget`),
    });

    const parsed = typeof value === 'number' ? value : Number(value);
    const changed = value !== '' && Number.isFinite(parsed) && parsed !== budget;
    const defaultLabel = formatUsd(defaultBudget);

    return (
        <Paper shadow="sm" p="md" radius="md" withBorder>
            <Title order={2} size="h4" mb={4}>
                <Trans>Weekly budget per account</Trans>
            </Title>
            <Text size="xs" c="dimmed" mb="md">
                <Trans>
                    What the assistant may cost each account from Monday midnight (Quebec time), in US dollars. Once
                    reached, it closes for that account until Monday. 0: no cap.
                </Trans>
            </Text>
            <Group align="flex-end" gap="sm">
                <NumberInput
                    label={t`Budget (USD)`}
                    value={value}
                    onChange={setValue}
                    min={0}
                    max={1000}
                    step={1}
                    decimalScale={2}
                    prefix="$ "
                    w={160}
                    disabled={updateBudget.isPending}
                />
                <Button onClick={() => save(parsed)} disabled={!changed} loading={updateBudget.isPending}>
                    {t`Save`}
                </Button>
            </Group>
            {budget !== defaultBudget && (
                <Text size="xs" c="dimmed" mt="xs">
                    <Trans>Server default: {defaultLabel}.</Trans>{' '}
                    <Anchor component="button" type="button" size="xs" onClick={() => save(null)}>
                        {t`Use it`}
                    </Anchor>
                </Text>
            )}
        </Paper>
    );
};
