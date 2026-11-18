import {useState} from "react";
import {plural, t} from "@lingui/macro";
import {Button, Textarea} from "@mantine/core";
import {useForm} from "@mantine/form";
import dayjs from "dayjs";
import {Event, IdParam} from "../../../types.ts";
import {EventChangeStatus} from "../../../api/eventChange.client.ts";
import {usePostponeEvent} from "../../../mutations/usePostponeEvent.ts";
import {useFormErrorResponseHandler} from "../../../hooks/useFormErrorResponseHandler.tsx";
import {showSuccess} from "../../../utilites/notifications.tsx";
import {utcToTz} from "../../../utilites/dates.ts";
import {Modal} from "../../common/Modal";
import {DateTimeField} from "../../common/DateTimeField";
import {ToggleRow} from "../../routes/organizer/Settings/SettingsUi.tsx";
import settings from "../../routes/organizer/Settings/Settings.module.scss";
import {formatWallClock, WALL_CLOCK} from "./wallClock.ts";
import classes from "./PostponeEventModal.module.scss";

const DEADLINE_HOURS_BEFORE = 48;

interface PostponeEventModalProps {
    eventId: IdParam;
    event: Event;
    audience?: EventChangeStatus['audience'];
    onClose: () => void;
    onPostponed: () => void;
}

interface PostponeForm {
    start_date: string;
    end_date: string;
    message: string;
    refunds_allowed: boolean;
    refund_deadline: string;
}

const defaultMessage = (title: string, start: string) => {
    const date = formatWallClock(start);
    return [
        t`Because of the weather forecast, we have to postpone ${title} to ${date}. Everyone's safety comes first.`,
        t`Thank you for your understanding, see you soon!`,
    ].join('\n\n');
};

// 48 hours before the new start; until the start itself when that is already past.
const defaultDeadline = (start: string) => {
    const deadline = dayjs(start).subtract(DEADLINE_HOURS_BEFORE, 'hour');
    return (deadline.isBefore(dayjs()) ? dayjs(start) : deadline).format(WALL_CLOCK);
};

/**
 * « Reporter l'événement »: the new dates (the end keeps the event's length), the message to the
 * participants and the refund offer, then a confirmation that says how many people get the email.
 */
export const PostponeEventModal = ({eventId, event, audience, onClose, onPostponed}: PostponeEventModalProps) => {
    const postponeMutation = usePostponeEvent();
    const handleFormError = useFormErrorResponseHandler();
    const timezone = event.timezone;
    const title = event.title ?? '';

    const currentStart = utcToTz(event.start_date, timezone) ?? dayjs().format(WALL_CLOCK);
    const currentEnd = utcToTz(event.end_date ?? undefined, timezone);
    const length = currentEnd ? Math.max(dayjs(currentEnd).diff(currentStart), 0) : null;
    const suggestedStart = dayjs(currentStart).add(1, 'week').format(WALL_CLOCK);

    const [step, setStep] = useState<'form' | 'confirm'>('form');
    const [messageEdited, setMessageEdited] = useState(false);
    const [deadlineEdited, setDeadlineEdited] = useState(false);

    const form = useForm<PostponeForm>({
        initialValues: {
            start_date: suggestedStart,
            end_date: length !== null ? dayjs(suggestedStart).add(length, 'millisecond').format(WALL_CLOCK) : '',
            message: defaultMessage(title, suggestedStart),
            refunds_allowed: true,
            refund_deadline: defaultDeadline(suggestedStart),
        },
        validate: {
            start_date: (value) => {
                if (!value) {
                    return t`Choose the new date.`;
                }
                return dayjs(value).isBefore(dayjs()) ? t`The new date must be in the future.` : null;
            },
            end_date: (value, values) => value && !dayjs(value).isAfter(values.start_date)
                ? t`The end must be after the start.`
                : null,
            message: (value) => value.trim() === '' ? t`Write a message to the participants.` : null,
            refund_deadline: (value, values) => {
                if (!values.refunds_allowed) {
                    return null;
                }
                if (!value) {
                    return t`Choose until when participants can ask.`;
                }
                if (dayjs(value).isBefore(dayjs())) {
                    return t`The refund deadline must be in the future.`;
                }
                return dayjs(value).isAfter(values.start_date) ? t`The refund deadline must be before the new start.` : null;
            },
        },
    });

    // The end, the message and the deadline follow the new start until they are changed by hand.
    const chooseStart = (value: string) => {
        form.setFieldValue('start_date', value);
        if (length !== null) {
            form.setFieldValue('end_date', dayjs(value).add(length, 'millisecond').format(WALL_CLOCK));
        }
        if (!messageEdited) {
            form.setFieldValue('message', defaultMessage(title, value));
        }
        if (!deadlineEdited) {
            form.setFieldValue('refund_deadline', defaultDeadline(value));
        }
    };

    const recipients = audience?.recipients ?? 0;
    const paidOnline = audience?.paid_online_orders ?? 0;
    const deadlineLabel = formatWallClock(form.values.refund_deadline);
    const newDateLabel = formatWallClock(form.values.start_date);

    const review = () => {
        if (!form.validate().hasErrors) {
            setStep('confirm');
        }
    };

    const submit = () => postponeMutation.mutate({
        eventId,
        request: {
            start_date: form.values.start_date,
            end_date: form.values.end_date || null,
            message: form.values.message.trim(),
            refunds_allowed: form.values.refunds_allowed,
            refund_deadline: form.values.refunds_allowed ? form.values.refund_deadline : null,
        },
    }, {
        onSuccess: () => {
            showSuccess(recipients > 0
                ? t`The event is postponed. The emails to the participants are on their way.`
                : t`The event is postponed.`);
            onPostponed();
            onClose();
        },
        onError: (error: any) => {
            setStep('form');
            handleFormError(form, error, error?.response?.data?.message || t`The event could not be postponed. Please try again.`);
        },
    });

    return (
        <Modal opened onClose={onClose} heading={t`Postpone the event`}>
            {step === 'form' ? (
                <div className={classes.body}>
                    <div className={classes.dates}>
                        <DateTimeField
                            label={t`New start`}
                            withWeekday
                            value={form.values.start_date}
                            error={form.errors.start_date}
                            onChange={chooseStart}
                        />
                        <DateTimeField
                            label={t`New end`}
                            withWeekday
                            clearable
                            value={form.values.end_date}
                            error={form.errors.end_date}
                            onChange={(value) => form.setFieldValue('end_date', value)}
                        />
                    </div>

                    <Textarea
                        className={settings.field}
                        label={t`Message to the participants`}
                        description={t`Sent by email to every buyer and participant, with the new date.`}
                        autosize
                        minRows={5}
                        maxLength={5000}
                        {...form.getInputProps('message')}
                        onChange={(changeEvent) => {
                            setMessageEdited(true);
                            form.setFieldValue('message', changeEvent.currentTarget.value);
                        }}
                    />

                    <ToggleRow
                        label={t`Participants who can't come can get a refund`}
                        hint={t`Orders paid online get a button in the email: one click cancels the order and refunds it in full.`}
                        checked={form.values.refunds_allowed}
                        onChange={(checked) => form.setFieldValue('refunds_allowed', checked)}
                    />

                    {form.values.refunds_allowed && (
                        <DateTimeField
                            label={t`They can ask until`}
                            withWeekday
                            value={form.values.refund_deadline}
                            error={form.errors.refund_deadline}
                            onChange={(value) => {
                                setDeadlineEdited(true);
                                form.setFieldValue('refund_deadline', value);
                            }}
                        />
                    )}

                    <div className={classes.actions}>
                        <Button variant="transparent" className={settings.outlineButton} onClick={onClose}>
                            {t`Close`}
                        </Button>
                        <Button variant="transparent" className={settings.inkButton} onClick={review}>
                            {t`Continue`}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className={classes.body}>
                    <div className={classes.summary}>
                        <p><strong>{t`New date: ${newDateLabel}`}</strong></p>
                        <p>
                            {recipients === 0
                                ? t`Nobody has a ticket yet: no email will be sent.`
                                : plural(recipients, {
                                    one: '# person will get your message by email.',
                                    other: '# people will get your message by email.',
                                })}
                        </p>
                        {form.values.refunds_allowed && paidOnline > 0 && (
                            <p>
                                {plural(paidOnline, {
                                    one: `The buyer of the order paid online can ask for a full refund until ${deadlineLabel}.`,
                                    other: `The buyers of the # orders paid online can ask for a full refund until ${deadlineLabel}.`,
                                })}
                            </p>
                        )}
                        <p>{t`Tickets stay valid, and sales that were open until the event stay open until the new date.`}</p>
                    </div>

                    <p className={classes.preview}>{form.values.message}</p>

                    <div className={classes.actions}>
                        <Button variant="transparent" className={settings.outlineButton} onClick={() => setStep('form')}
                                disabled={postponeMutation.isPending}>
                            {t`Back`}
                        </Button>
                        <Button variant="transparent" className={settings.inkButton} onClick={submit}
                                loading={postponeMutation.isPending}>
                            {recipients > 0
                                ? plural(recipients, {one: 'Postpone and notify # person', other: 'Postpone and notify # people'})
                                : t`Postpone the event`}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
};
