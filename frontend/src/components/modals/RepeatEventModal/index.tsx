import {useMemo, useState} from "react";
import {plural, t} from "@lingui/macro";
import {Button, Checkbox, NumberInput, UnstyledButton} from "@mantine/core";
import classNames from "classnames";
import dayjs from "dayjs";
import {Event, GenericModalProps, IdParam} from "../../../types.ts";
import {DehorsPopup} from "../../common/DehorsPopup";
import {DateTimeField} from "../../common/DateTimeField";
import {useRepeatEvent} from "../../../mutations/useRepeatEvent.ts";
import {showError, showSuccess} from "../../../utilites/notifications.tsx";
import {intlLocale} from "../../../utilites/intlLocale.ts";
import {clockTime} from "../../../utilites/eventStartLabel.ts";
import {
    eventLocalDay,
    LAST_WEEK_OF_MONTH,
    MAX_REPEATED_DATES,
    occurrenceStart,
    RepeatEnd,
    repeatedDates,
    RepeatFrequency,
    weekOfMonth,
} from "../../../utilites/recurrence.ts";
import popup from "../CreateEventModal/CreateEventModal.module.scss";
import classes from "./RepeatEventModal.module.scss";

type EndType = RepeatEnd['type'];

const DEFAULT_COUNT = 8;

// A refused request: Laravel's validation messages (« dates ») or the server's message.
type ErrorResponse = { response?: { data?: { message?: string, errors?: Record<string, string[]> } } };

interface RepeatEventModalProps extends GenericModalProps {
    eventId: IdParam;
    event: Event;
}

/**
 * « Répéter cet événement »: the next dates of a club's outing at the same time (every week, every
 * two weeks, or the same weekday of every month), each one ticked to be created as a full copy.
 */
export const RepeatEventModal = ({eventId, event, onClose}: RepeatEventModalProps) => {
    const mutation = useRepeatEvent();
    const [frequency, setFrequency] = useState<RepeatFrequency>('WEEKLY');
    const [endType, setEndType] = useState<EndType>('COUNT');
    const [count, setCount] = useState<number | string>(DEFAULT_COUNT);
    const [until, setUntil] = useState(() => dayjs.utc(eventLocalDay(event.start_date, event.timezone))
        .add(3, 'month')
        .format('YYYY-MM-DD'));
    const [skipped, setSkipped] = useState<string[]>([]);

    const locale = intlLocale();
    const eventDay = eventLocalDay(event.start_date, event.timezone);
    const weekday = new Intl.DateTimeFormat(locale, {weekday: 'long', timeZone: event.timezone})
        .format(new Date(event.start_date));
    const week = weekOfMonth(eventDay);
    const ordinals: Record<number, string> = {
        1: t`1st`,
        2: t`2nd`,
        3: t`3rd`,
        4: t`4th`,
        [LAST_WEEK_OF_MONTH]: t({message: 'last', context: 'week of the month'}),
    };
    const ordinal = ordinals[week];

    const frequencies: { value: RepeatFrequency, label: string }[] = [
        {value: 'WEEKLY', label: t`Every week`},
        {value: 'BIWEEKLY', label: t`Every two weeks`},
        {value: 'MONTHLY', label: t`Every month`},
    ];

    const ends: { value: EndType, label: string }[] = [
        {value: 'COUNT', label: t`After a number of dates`},
        {value: 'UNTIL', label: t`On a given date`},
    ];

    const {dates, truncated} = useMemo(() => repeatedDates(
        event.start_date,
        event.timezone,
        frequency,
        endType === 'COUNT' ? {type: 'COUNT', count: Number(count) || 0} : {type: 'UNTIL', until},
    ), [event.start_date, event.timezone, frequency, endType, count, until]);

    const chosen = dates.filter((date) => !skipped.includes(date));
    const chosenCount = chosen.length;
    const total = dates.length;

    const toggle = (date: string, checked: boolean) => setSkipped((current) => checked
        ? current.filter((skippedDate) => skippedDate !== date)
        : [...current, date]);

    const label = (date: string) => {
        const start = occurrenceStart(date, event.start_date, event.timezone).toDate();
        const day = new Intl.DateTimeFormat(locale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: event.timezone,
        }).format(start);

        return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${clockTime(start, event.timezone)}`;
    };

    const dayLabel = (date: string) => new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
    }).format(dayjs.utc(date).toDate());

    const submit = () => mutation.mutate({eventId, dates: chosen}, {
        onSuccess: ({data, meta}) => {
            const created = data.length;
            if (meta?.failed_date) {
                const failed = dayLabel(meta.failed_date);
                showError(
                    plural(created, {
                        one: `# date was added. The creation stopped at ${failed}: try again for the next ones.`,
                        other: `# dates were added. The creation stopped at ${failed}: try again for the next ones.`,
                    }),
                    undefined,
                    false,
                );
            } else {
                showSuccess(plural(created, {
                    one: '# date added. Find it in your events.',
                    other: '# dates added. Find them in your events.',
                }));
            }
            onClose();
        },
        onError: (error) => {
            const response = (error as ErrorResponse).response?.data;
            const message = Object.values(response?.errors ?? {}).flat()[0];
            showError(message || response?.message || t`The dates could not be created. Please try again.`);
        },
    });

    return (
        <DehorsPopup onClose={onClose} title={t`Repeat this event`}>
            <div className={popup.form}>
                <p className={classes.intro}>
                    {t`Each date is a full copy of this event, at the same time: tickets, questions, settings and check-in lists. Sales open and close as long before each date.`}
                </p>

                <div className={popup.field} role="radiogroup" aria-labelledby="repeat-frequency">
                    <span id="repeat-frequency" className={popup.label}>{t`Frequency`}</span>
                    <div className={popup.choices}>
                        {frequencies.map((option) => (
                            <UnstyledButton
                                key={option.value}
                                role="radio"
                                aria-checked={frequency === option.value}
                                className={classNames(popup.choice, {[popup.choiceSelected]: frequency === option.value})}
                                onClick={() => setFrequency(option.value)}
                            >
                                {option.label}
                            </UnstyledButton>
                        ))}
                    </div>
                    {frequency === 'MONTHLY' && (
                        <span className={classes.hint}>{t`On the ${ordinal} ${weekday} of every month`}</span>
                    )}
                </div>

                <div className={popup.field} role="radiogroup" aria-labelledby="repeat-end">
                    <span id="repeat-end" className={popup.label}>{t({message: 'Ends', context: 'repeated event'})}</span>
                    <div className={popup.choices}>
                        {ends.map((option) => (
                            <UnstyledButton
                                key={option.value}
                                role="radio"
                                aria-checked={endType === option.value}
                                className={classNames(popup.choice, {[popup.choiceSelected]: endType === option.value})}
                                onClick={() => setEndType(option.value)}
                            >
                                {option.label}
                            </UnstyledButton>
                        ))}
                    </div>
                    {endType === 'COUNT' ? (
                        <NumberInput
                            className={classes.end}
                            classNames={{input: popup.input}}
                            aria-label={t`Number of dates`}
                            allowDecimal={false}
                            allowNegative={false}
                            hideControls
                            min={1}
                            max={MAX_REPEATED_DATES}
                            clampBehavior="strict"
                            value={count}
                            onChange={setCount}
                            rightSection={<span className={classes.unit}>{t({message: 'dates', context: 'number of dates'})}</span>}
                            rightSectionWidth={72}
                        />
                    ) : (
                        <DateTimeField
                            className={classes.end}
                            value={until}
                            onChange={setUntil}
                            withWeekday
                            dateOnly
                        />
                    )}
                </div>

                <div className={popup.field}>
                    <div className={classes.previewHead}>
                        <span className={popup.label}>{t`Dates to create`}</span>
                        {dates.length > 0 && (
                            <span className={classes.count}>{t`${chosenCount} of ${total} dates`}</span>
                        )}
                    </div>
                    {dates.length === 0 ? (
                        <p className={classes.empty}>{t`No upcoming date with these choices.`}</p>
                    ) : (
                        <ul className={classes.dates}>
                            {dates.map((date) => (
                                <li key={date}>
                                    <Checkbox
                                        className={classes.date}
                                        data-skipped={skipped.includes(date) || undefined}
                                        label={label(date)}
                                        checked={!skipped.includes(date)}
                                        onChange={(changeEvent) => toggle(date, changeEvent.currentTarget.checked)}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                    <span className={classes.hint}>
                        {truncated
                            ? t`At most ${MAX_REPEATED_DATES} dates at a time: repeat again from the last one for the next ones.`
                            : t`Uncheck a date to skip it (a holiday, a race the same day…).`}
                    </span>
                </div>

                <div className={popup.actions}>
                    <Button
                        className={popup.submit}
                        onClick={submit}
                        loading={mutation.isPending}
                        disabled={chosenCount === 0}
                    >
                        {plural(chosenCount, {one: 'Create # date', other: 'Create # dates'})}
                    </Button>
                </div>
            </div>
        </DehorsPopup>
    );
};
