import {useState} from "react";
import dayjs from "dayjs";
import {t, Trans} from "@lingui/macro";
import {Alert, Button, Group, List, Loader, Modal, Stack, Text, TextInput} from "@mantine/core";
import {isEmail, useForm} from "@mantine/form";
import {IconInfoCircle} from "@tabler/icons-react";
import {Attendee, IdParam} from "../../../types.ts";
import {InputGroup} from "../../common/InputGroup";
import {useGetTicketTransfer} from "../../../queries/useGetTicketTransfer.ts";
import {useTransferTicket} from "../../../mutations/useTransferTicket.ts";
import {TicketTransferRecipient} from "../../../api/ticketTransfer.client.ts";
import {formatDateWithLocale} from "../../../utilites/dates.ts";
import {showError} from "../../../utilites/notifications.tsx";
import {useFormErrorResponseHandler} from "../../../hooks/useFormErrorResponseHandler.tsx";

/**
 * « samedi 21 novembre à 20:59 », in the event's timezone.
 */
export const transferDeadlineLabel = (deadline: string, timezone: string): string => {
    const day = formatDateWithLocale(deadline, 'dayName', timezone);
    const time = formatDateWithLocale(deadline, 'timeOnly', timezone);
    return t`${day} at ${time}`;
};

/**
 * Whether the organizer's cutoff is still ahead, to offer the transfer at all (the server has the last word).
 */
export const isTransferWindowOpen = (startDate?: string, cutoffHours = 48): boolean =>
    !startDate || dayjs.utc(startDate).subtract(cutoffHours, 'hour').isAfter(dayjs());

interface TransferTicketModalProps {
    onClose: () => void;
    eventId: IdParam;
    timezone: string;
    attendee: Pick<Attendee, 'first_name' | 'last_name' | 'email' | 'short_id'>;
    onTransferred: (newHolderName: string) => void;
}

/**
 * Gives a ticket to someone else: their name and email (typed twice), then an explicit confirmation.
 * The server decides whether the ticket can still be transferred.
 */
export const TransferTicketModal = ({onClose, eventId, timezone, attendee, onTransferred}: TransferTicketModalProps) => {
    const eligibilityQuery = useGetTicketTransfer(eventId, attendee.short_id);
    const mutation = useTransferTicket();
    const errorHandler = useFormErrorResponseHandler();
    const [step, setStep] = useState<'form' | 'confirm'>('form');

    const form = useForm<TicketTransferRecipient>({
        initialValues: {
            first_name: '',
            last_name: '',
            email: '',
            email_confirmation: '',
        },
        validate: {
            first_name: (value) => !value.trim() ? t`First name is required` : null,
            last_name: (value) => !value.trim() ? t`Last name is required` : null,
            email: (value) => {
                const invalid = isEmail(t`Please enter a valid email address`)(value.trim());
                if (invalid) {
                    return invalid;
                }
                return value.trim().toLowerCase() === (attendee.email || '').trim().toLowerCase()
                    ? t`Enter the new participant's email, not the current one.`
                    : null;
            },
            email_confirmation: (value, values) => value.trim().toLowerCase() !== values.email.trim().toLowerCase()
                ? t`The two email addresses do not match.`
                : null,
        },
        validateInputOnBlur: true,
    });

    const currentName = `${attendee.first_name} ${attendee.last_name}`.trim();
    const newName = `${form.values.first_name.trim()} ${form.values.last_name.trim()}`.trim();
    const newEmail = form.values.email.trim();
    const eligibility = eligibilityQuery.data;

    const submit = () => {
        mutation.mutate({
            eventId,
            attendeeShortId: attendee.short_id,
            recipient: {
                first_name: form.values.first_name.trim(),
                last_name: form.values.last_name.trim(),
                email: newEmail,
                email_confirmation: form.values.email_confirmation.trim(),
            },
        }, {
            onSuccess: () => onTransferred(newName),
            onError: (error: any) => {
                const status = error?.response?.status;
                if (status === 429) {
                    showError(t`Rate limit exceeded. Please try again later.`);
                } else if (status === 422) {
                    setStep('form');
                    errorHandler(form, error);
                } else {
                    showError(error?.response?.data?.message || t`The ticket could not be transferred. Please try again.`);
                    eligibilityQuery.refetch();
                    setStep('form');
                }
            },
        });
    };

    const renderBody = () => {
        if (eligibilityQuery.isLoading) {
            return <Group justify="center" py="xl"><Loader size="sm"/></Group>;
        }

        if (eligibilityQuery.isError || !eligibility) {
            return (
                <Stack>
                    <Alert color="red" icon={<IconInfoCircle size={16}/>}>
                        {t`This ticket can no longer be found. The link may have changed.`}
                    </Alert>
                    <Group justify="flex-end">
                        <Button variant="default" onClick={onClose}>{t`Close`}</Button>
                    </Group>
                </Stack>
            );
        }

        if (!eligibility.can_transfer) {
            return (
                <Stack>
                    <Alert color="orange" icon={<IconInfoCircle size={16}/>}>
                        {eligibility.refusal_message || t`This ticket cannot be transferred.`}
                    </Alert>
                    <Group justify="flex-end">
                        <Button variant="default" onClick={onClose}>{t`Close`}</Button>
                    </Group>
                </Stack>
            );
        }

        const deadline = eligibility.deadline ? transferDeadlineLabel(eligibility.deadline, timezone) : null;

        if (step === 'confirm') {
            return (
                <Stack>
                    <Text>
                        <Trans>
                            Transfer the ticket of <strong>{currentName}</strong> to <strong>{newName}</strong> ({newEmail})?
                        </Trans>
                    </Text>
                    <List size="sm" spacing={6}>
                        <List.Item>{t`${newName} receives the ticket by email.`}</List.Item>
                        <List.Item>{t`The current ticket, its link and its QR code stop working, including screenshots and wallet passes.`}</List.Item>
                        <List.Item>{t`The new participant fills in their own participant details and signs the required documents, if the event asks for them.`}</List.Item>
                    </List>
                    <Text size="sm" c="dimmed">{t`This cannot be undone.`}</Text>
                    <Group justify="flex-end" gap="sm">
                        <Button variant="default" onClick={() => setStep('form')} disabled={mutation.isPending}>
                            {t`Back`}
                        </Button>
                        <Button onClick={submit} loading={mutation.isPending}>
                            {t`Transfer the ticket`}
                        </Button>
                    </Group>
                </Stack>
            );
        }

        return (
            <form onSubmit={form.onSubmit(() => setStep('confirm'))}>
                <Stack gap="xs">
                    <Text size="sm">
                        {t`Can't make it? Give your spot to someone else: they receive the ticket by email, and the current ticket stops working.`}
                    </Text>
                    {deadline && (
                        <Text size="sm" c="dimmed">{t`Possible until ${deadline}.`}</Text>
                    )}
                    <InputGroup>
                        <TextInput
                            label={t`First Name`}
                            required
                            autoComplete="off"
                            {...form.getInputProps('first_name')}
                        />
                        <TextInput
                            label={t`Last Name`}
                            required
                            autoComplete="off"
                            {...form.getInputProps('last_name')}
                        />
                    </InputGroup>
                    <TextInput
                        label={t`Email`}
                        type="email"
                        required
                        autoComplete="off"
                        {...form.getInputProps('email')}
                    />
                    <TextInput
                        label={t`Confirm email`}
                        type="email"
                        required
                        autoComplete="off"
                        {...form.getInputProps('email_confirmation')}
                    />
                    <Group justify="flex-end" gap="sm" mt="md">
                        <Button variant="default" onClick={onClose}>{t`Cancel`}</Button>
                        <Button type="submit">{t`Continue`}</Button>
                    </Group>
                </Stack>
            </form>
        );
    };

    return (
        <Modal opened onClose={onClose} title={t`Transfer the ticket of ${currentName}`} size="md">
            {renderBody()}
        </Modal>
    );
};
