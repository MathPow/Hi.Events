import {ReactNode, useCallback, useEffect, useId, useMemo, useState} from "react";
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
}

const timeLabel = (time: string) => clockTime(dayjs(`2000-01-15T${time}`).toDate(), undefined);

const HALF_HOURS = Array.from({length: 48}, (_, index) => {
    const hour = String(Math.floor(index / 2)).padStart(2, '0');
    return `${hour}:${index % 2 ? '30' : '00'}`;
});

/**
 * The homemade calendar (Figma « Menu ouvert · Calendrier et heure », 552:3499) in place of the
 * browser's picker: a field that opens the month and the hours in capsules. A day keeps the time,
 * an hour closes it.
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

    // The chosen hour in view when the menu opens (the usual time when there is none yet).
    const hours = useCallback((list: HTMLDivElement | null) => {
        const shownTime = list?.querySelector<HTMLElement>('[aria-pressed="true"]')
            ?? list?.querySelector<HTMLElement>('[data-default="true"]');
        if (list && shownTime) {
            list.scrollTop = shownTime.offsetTop - list.clientHeight / 2 + shownTime.offsetHeight / 2;
        }
    }, []);

    const times = useMemo(() => (selectedTime && !HALF_HOURS.includes(selectedTime)
        ? [...HALF_HOURS, selectedTime].sort()
        : HALF_HOURS), [selectedTime]);

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
        } as Intl.DateTimeFormatOptions).format(selected.toDate())} · ${clockTime(selected.toDate(), undefined)}`
        : (placeholder ?? '');

    const pickDay = (day: Dayjs) => onChange(`${day.format('YYYY-MM-DD')}T${selectedTime ?? defaultTime}`);

    const pickTime = (time: string) => {
        onChange(`${(selected ?? dayjs()).format('YYYY-MM-DD')}T${time}`);
        setOpened(false);
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
                    <div className={classes.timeBlock}>
                        <span className={classes.timeLabel}>{t`Time`}</span>
                        <div className={classes.times} ref={hours}>
                            {times.map(time => (
                                <button key={time} type="button" className={classes.time}
                                        data-default={time === defaultTime || undefined}
                                        aria-pressed={time === selectedTime} onClick={() => pickTime(time)}>
                                    {timeLabel(time)}
                                </button>
                            ))}
                        </div>
                    </div>
                    {clearable && selected && (
                        <button type="button" className={classes.clear} onClick={() => {
                            onChange('');
                            setOpened(false);
                        }}>
                            {t`Clear`}
                        </button>
                    )}
                </Popover.Dropdown>
            </Popover>
            {error && <InputError className={classes.error}>{error}</InputError>}
        </div>
    );
};

