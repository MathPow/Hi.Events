import {ReactNode, useEffect, useId, useState} from "react";
import {InputError, InputLabel, Popover} from "@mantine/core";
import {t} from "@lingui/macro";
import dayjs, {Dayjs} from "dayjs";
import {intlLocale} from "../../../utilites/intlLocale.ts";
import {clockTime} from "../../../utilites/eventStartLabel.ts";
import classes from "./DateTimeField.module.scss";

const ICONS = '/interface/admin/commandes';

interface DateTimeFieldProps {
    label?: ReactNode;
    // The wall clock of the event, « 2026-11-07T08:00 », as `utcToTz` gives it.
    value: string | null | undefined;
    onChange: (value: string) => void;
    // Optional dates (the end of an event, a sale period) can be emptied.
    clearable?: boolean;
    placeholder?: string;
    error?: ReactNode;
    className?: string;
    // « sam. 7 nov. 2026 » rather than « 7 nov. 2026 ».
    withWeekday?: boolean;
    // The time given to a date picked first (« 09:00 »).
    defaultTime?: string;
    // A day alone (« 2026-12-15 »), without the time field.
    dateOnly?: boolean;
}

/**
 * The homemade calendar (Figma « Menu ouvert · Calendrier et heure », 552:3499) in place of the
 * browser's picker: a field that opens the month, with a classic time field under it (the
 * browser's own, in the language's 12 or 24 hour clock, a wheel on phones). A day keeps the time.
 */
export const DateTimeField = ({
    label,
    value,
    onChange,
    clearable,
    placeholder,
    error,
    className,
    withWeekday,
    defaultTime = '09:00',
    dateOnly,
}: DateTimeFieldProps) => {
    const id = useId();
    const locale = intlLocale();
    const [opened, setOpened] = useState(false);
    const selected = value && dayjs(value).isValid() ? dayjs(value) : null;
    const [month, setMonth] = useState<Dayjs>((selected ?? dayjs()).startOf('month'));
    const selectedTime = selected?.format('HH:mm') ?? null;

    useEffect(() => {
        if (opened) {
            setMonth((selected ?? dayjs()).startOf('month'));
        }
    }, [opened]);

    const first = month.startOf('month');
    const days = Array.from({length: first.daysInMonth()}, (_, index) => first.add(index, 'day'));
    const monthLabel = new Intl.DateTimeFormat(locale, {month: 'long', year: 'numeric'}).format(first.toDate());
    const weekdays = Array.from({length: 7}, (_, index) => new Intl.DateTimeFormat(locale, {weekday: 'narrow'})
        .format(dayjs().day(index).toDate()));

    const shown = selected
        ? `${new Intl.DateTimeFormat(locale, {
            ...(withWeekday ? {weekday: 'short'} : {}),
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        } as Intl.DateTimeFormatOptions).format(selected.toDate())}${dateOnly ? '' : ` · ${clockTime(selected.toDate(), undefined)}`}`
        : (placeholder ?? '');

    const pickDay = (day: Dayjs) => onChange(dateOnly
        ? day.format('YYYY-MM-DD')
        : `${day.format('YYYY-MM-DD')}T${selectedTime ?? defaultTime}`);

    // While the hour is being typed, the field reports an empty value: only a full time counts.
    const pickTime = (time: string) => {
        if (/^\d{2}:\d{2}/.test(time)) {
            onChange(`${(selected ?? dayjs()).format('YYYY-MM-DD')}T${time.slice(0, 5)}`);
        }
    };

    return (
        <div className={className}>
            {label && <InputLabel className={classes.label} htmlFor={id}>{label}</InputLabel>}
            <Popover
                opened={opened}
                onChange={setOpened}
                position="bottom-start"
                width={340}
                withinPortal
                middlewares={{flip: true, shift: true}}
                classNames={{dropdown: classes.menu}}
            >
                <Popover.Target>
                    <button
                        id={id}
                        type="button"
                        className={classes.input}
                        data-empty={!selected || undefined}
                        data-error={!!error || undefined}
                        aria-haspopup="dialog"
                        aria-expanded={opened}
                        onClick={() => setOpened(current => !current)}
                    >
                        <img src="/interface/admin/parametres/calendrier.svg" width={20} height={20} alt=""/>
                        <span className={classes.value}>{shown}</span>
                    </button>
                </Popover.Target>
                <Popover.Dropdown>
                    <div className={classes.head}>
                        <button type="button" className={classes.monthButton} aria-label={t`Previous month`}
                                onClick={() => setMonth(month.subtract(1, 'month'))}>
                            <img src={`${ICONS}/chevron-gauche-16.svg`} width={16} height={16} alt=""/>
                        </button>
                        <span className={classes.month} aria-live="polite">{monthLabel}</span>
                        <button type="button" className={classes.monthButton} aria-label={t`Next month`}
                                onClick={() => setMonth(month.add(1, 'month'))}>
                            <img src={`${ICONS}/chevron-droite-16.svg`} width={16} height={16} alt=""/>
                        </button>
                    </div>
                    <div className={classes.weekdays} aria-hidden>
                        {weekdays.map((weekday, index) => <span key={index}>{weekday}</span>)}
                    </div>
                    <div className={classes.days}>
                        {Array.from({length: first.day()}, (_, index) => <span key={`blank-${index}`}/>)}
                        {days.map(day => (
                            <button
                                key={day.date()}
                                type="button"
                                className={classes.day}
                                aria-pressed={!!selected && day.isSame(selected, 'day')}
                                aria-label={new Intl.DateTimeFormat(locale, {dateStyle: 'full'}).format(day.toDate())}
                                data-today={day.isSame(dayjs(), 'day') || undefined}
                                onClick={() => pickDay(day)}
                            >
                                {day.date()}
                            </button>
                        ))}
                    </div>
                    {!dateOnly && <div className={classes.timeBlock}>
                        <label className={classes.timeLabel} htmlFor={`${id}-time`}>{t`Time`}</label>
                        <input
                            id={`${id}-time`}
                            type="time"
                            step={300}
                            className={classes.timeInput}
                            value={selectedTime ?? defaultTime}
                            onChange={(event) => pickTime(event.currentTarget.value)}
                            onKeyDown={(event) => event.key === 'Enter' && setOpened(false)}
                        />
                    </div>}
                    <div className={classes.footer}>
                        {clearable && selected ? (
                            <button type="button" className={classes.clear} onClick={() => {
                                onChange('');
                                setOpened(false);
                            }}>
                                {t`Clear`}
                            </button>
                        ) : <span/>}
                        <button type="button" className={classes.done} onClick={() => setOpened(false)}>
                            {t`Done`}
                        </button>
                    </div>
                </Popover.Dropdown>
            </Popover>
            {error && <InputError className={classes.error}>{error}</InputError>}
        </div>
    );
};

