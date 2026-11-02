import {ReactNode, useState} from "react";
import {Drawer, Popover, UnstyledButton} from "@mantine/core";
import {t} from "@lingui/macro";
import {useLingui} from "@lingui/react";
import dayjs, {Dayjs} from "dayjs";
import {MenuTrigger} from "../../../common/EventFilters";
import {PublicIcon} from "../../../common/PublicIcon";
import filterClasses from "../../../common/EventFilters/EventFilters.module.scss";
import classes from "./OrdersAndAttendees.module.scss";

export const ICONS = '/interface/admin/commandes';

export interface CheckChoice {
    value: string;
    label: string;
    count?: number;
}

// Quebec French reads « 20 oct. », « 9 h 12 ».
const useLocale = () => {
    const {i18n} = useLingui();
    return i18n.locale.startsWith('fr') ? 'fr-CA' : i18n.locale;
};

/** A checkbox with its count on the right (« Complétée … 89 »), in a menu or a sheet. */
const CheckOption = ({choice, checked, onToggle}: { choice: CheckChoice, checked: boolean, onToggle: () => void }) => (
    <label className={classes.checkOption} data-checked={checked || undefined}>
        <input type="checkbox" checked={checked} onChange={onToggle} className={classes.checkInput}/>
        <span className={classes.checkBox} aria-hidden>{checked && <PublicIcon name={'coche'} size={14}/>}</span>
        <span className={classes.checkLabel}>{choice.label}</span>
        {choice.count !== undefined && <span className={classes.checkCount}>{choice.count}</span>}
    </label>
);

const toggled = (values: string[], value: string) => values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];

/**
 * « Statut » and « Tous les billets » (Figma 549:3024, 549:3851): checkboxes with their counts, applied
 * at once, « Effacer » at the bottom. The button takes an ink outline while open.
 */
export const CheckMenu = ({icon, label, heading, choices, value, onChange, width = 300}: {
    // The image beside the label, as its path.
    icon: string,
    label: string,
    heading: string,
    choices: CheckChoice[],
    value: string[],
    onChange: (value: string[]) => void,
    width?: number,
}) => {
    const [opened, setOpened] = useState(false);

    return (
        <Popover opened={opened} onChange={setOpened} position="bottom-end" offset={10} width={width}
                 trapFocus classNames={{dropdown: `${filterClasses.menu} ${classes.dropdown}`}}>
            <Popover.Target>
                <MenuTrigger opened={opened} active={value.length > 0} onClick={() => setOpened((current) => !current)}>
                    <img src={icon} width={18} height={18} alt="" className={classes.triggerIcon}/>
                    <span className={classes.triggerLabel}>{label}</span>
                </MenuTrigger>
            </Popover.Target>
            <Popover.Dropdown>
                <span className={classes.menuHeading}>{heading}</span>
                <div role="group" aria-label={heading} className={classes.checkOptions}>
                    {choices.map((choice) => (
                        <CheckOption key={choice.value} choice={choice} checked={value.includes(choice.value)}
                                     onToggle={() => onChange(toggled(value, choice.value))}/>
                    ))}
                </div>
                <button type="button" className={classes.clear} onClick={() => onChange([])}
                        disabled={value.length === 0}>
                    {t`Clear`}
                </button>
            </Popover.Dropdown>
        </Popover>
    );
};

// ── Dates ───────────────────────────────────────────────────────────────────────────────────────

export type DatePreset = 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'SINCE_ON_SALE' | 'CUSTOM';

export interface DateRange {
    preset: DatePreset | null;
    start: Dayjs | null;
    end: Dayjs | null;
}

export const NO_DATES: DateRange = {preset: null, start: null, end: null};

const presetLabel = (preset: DatePreset) => ({
    TODAY: t`Today`,
    LAST_7_DAYS: t`Last 7 days`,
    LAST_30_DAYS: t`Last 30 days`,
    SINCE_ON_SALE: t`Since sales opened`,
    CUSTOM: t`Custom period`,
})[preset];

/** The days a shortcut covers, up to today; « since sales opened » starts at the given day. */
export const presetRange = (preset: Exclude<DatePreset, 'CUSTOM'>, onSaleSince: Dayjs): DateRange => {
    const today = dayjs().startOf('day');
    const start = {
        TODAY: today,
        LAST_7_DAYS: today.subtract(6, 'day'),
        LAST_30_DAYS: today.subtract(29, 'day'),
        SINCE_ON_SALE: onSaleSince.startOf('day'),
    }[preset];

    return {preset, start, end: today};
};

/** « 20 – 29 oct. », « 28 sept. – 3 oct. », « 20 oct. »: what the Dates button shows. */
const useRangeLabel = () => {
    const locale = useLocale();
    const dayMonth = (day: Dayjs) => new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'short'})
        .format(day.toDate());

    return (range: DateRange): string => {
        if (!range.start) {
            return t`Dates`;
        }
        if (range.preset && range.preset !== 'CUSTOM') {
            return presetLabel(range.preset);
        }
        const end = range.end ?? range.start;
        if (end.isSame(range.start, 'day')) {
            return dayMonth(range.start);
        }
        return end.isSame(range.start, 'month')
            ? `${range.start.date()} – ${dayMonth(end)}`
            : `${dayMonth(range.start)} – ${dayMonth(end)}`;
    };
};

/**
 * The homemade calendar (Figma « Calendrier maison », 549:3434): first click the start, second the
 * end; the days between in pale orange, both ends in dark circles. Sunday first, as in Quebec.
 */
export const Calendar = ({range, onChange}: { range: DateRange, onChange: (range: DateRange) => void }) => {
    const locale = useLocale();
    const [month, setMonth] = useState<Dayjs>((range.start ?? dayjs()).startOf('month'));
    const first = month.startOf('month');
    const days = Array.from({length: first.daysInMonth()}, (_, index) => first.add(index, 'day'));
    const blanks = first.day();
    const monthLabel = new Intl.DateTimeFormat(locale, {month: 'long', year: 'numeric'}).format(first.toDate());
    const weekdays = Array.from({length: 7}, (_, index) => new Intl.DateTimeFormat(locale, {weekday: 'narrow'})
        .format(dayjs().day(index).toDate()));
    const longDay = (day: Dayjs) => new Intl.DateTimeFormat(locale, {dateStyle: 'full'}).format(day.toDate());

    const pick = (day: Dayjs) => {
        if (!range.start || range.end) {
            onChange({preset: 'CUSTOM', start: day, end: null});
            return;
        }
        onChange(day.isBefore(range.start, 'day')
            ? {preset: 'CUSTOM', start: day, end: range.start}
            : {preset: 'CUSTOM', start: range.start, end: day});
    };

    const dayState = (day: Dayjs) => {
        const isStart = !!range.start && day.isSame(range.start, 'day');
        const isEnd = !!range.end && day.isSame(range.end, 'day');
        const inside = !!range.start && !!range.end && day.isAfter(range.start, 'day') && day.isBefore(range.end, 'day');
        return {
            edge: isStart || isEnd,
            inRange: inside || ((isStart || isEnd) && !!range.end && !range.start?.isSame(range.end, 'day')),
            rangeStart: isStart && !!range.end,
            rangeEnd: isEnd,
        };
    };

    return (
        <div className={classes.calendar}>
            <div className={classes.calendarHead}>
                <button type="button" className={classes.monthButton} onClick={() => setMonth(month.subtract(1, 'month'))}
                        aria-label={t`Previous month`}>
                    <img src={`${ICONS}/chevron-gauche-16.svg`} width={16} height={16} alt=""/>
                </button>
                <span className={classes.monthLabel} aria-live="polite">{monthLabel}</span>
                <button type="button" className={classes.monthButton} onClick={() => setMonth(month.add(1, 'month'))}
                        aria-label={t`Next month`}>
                    <img src={`${ICONS}/chevron-droite-16.svg`} width={16} height={16} alt=""/>
                </button>
            </div>
            <div className={classes.weekdays} aria-hidden>
                {weekdays.map((weekday, index) => <span key={index}>{weekday}</span>)}
            </div>
            <div className={classes.days}>
                {Array.from({length: blanks}, (_, index) => <span key={`blank-${index}`}/>)}
                {days.map((day) => {
                    const state = dayState(day);
                    return (
                        <span key={day.date()} className={classes.dayCell} data-in-range={state.inRange || undefined}
                              data-range-start={state.rangeStart || undefined} data-range-end={state.rangeEnd || undefined}>
                            <button type="button" className={classes.day} data-edge={state.edge || undefined}
                                    data-today={day.isSame(dayjs(), 'day') || undefined}
                                    aria-pressed={state.edge} aria-label={longDay(day)} onClick={() => pick(day)}>
                                {day.date()}
                            </button>
                        </span>
                    );
                })}
            </div>
        </div>
    );
};

const DateField = ({label, day}: { label: string, day: Dayjs | null }) => {
    const locale = useLocale();

    return (
        <div className={classes.dateField}>
            <span className={classes.dateFieldLabel}>{label}</span>
            <span className={classes.dateFieldValue}>
                <img src={`${ICONS}/calendrier-16.svg`} width={16} height={16} alt=""/>
                {day ? new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'short', year: 'numeric'}).format(day.toDate()) : '—'}
            </span>
        </div>
    );
};

const PRESETS: Exclude<DatePreset, 'CUSTOM'>[] = ['TODAY', 'LAST_7_DAYS', 'LAST_30_DAYS', 'SINCE_ON_SALE'];

/** « Dates » (Figma 549:3405): shortcuts on the left, « Du / Au » and the calendar on the right. */
export const DateRangeMenu = ({value, onChange, onSaleSince}: {
    value: DateRange,
    onChange: (value: DateRange) => void,
    onSaleSince: Dayjs,
}) => {
    const [opened, setOpened] = useState(false);
    const rangeLabel = useRangeLabel();
    // The custom period being picked, shown before its second click is made.
    const [draft, setDraft] = useState<DateRange | null>(null);
    const shown = draft ?? value;

    const choosePreset = (preset: Exclude<DatePreset, 'CUSTOM'>) => {
        setDraft(null);
        onChange(presetRange(preset, onSaleSince));
        setOpened(false);
    };

    const pickDays = (range: DateRange) => {
        if (range.end) {
            setDraft(null);
            onChange(range);
        } else {
            setDraft(range);
        }
    };

    return (
        <Popover opened={opened} onChange={(next) => {
            setOpened(next);
            setDraft(null);
        }} position="bottom-end" offset={10} width={640} trapFocus
                 classNames={{dropdown: `${filterClasses.menu} ${classes.dropdown} ${classes.datesDropdown}`}}>
            <Popover.Target>
                <MenuTrigger opened={opened} active={!!value.start} onClick={() => setOpened((current) => !current)}>
                    <img src={`${ICONS}/calendrier.svg`} width={18} height={18} alt="" className={classes.triggerIcon}/>
                    <span className={classes.triggerLabel}>{rangeLabel(value)}</span>
                </MenuTrigger>
            </Popover.Target>
            <Popover.Dropdown>
                <div className={classes.datesMenu}>
                    <div className={classes.shortcuts}>
                        <div className={classes.shortcutList}>
                            <span className={classes.menuHeading}>{t`Shortcuts`}</span>
                            {PRESETS.map((preset) => (
                                <UnstyledButton key={preset} className={classes.shortcut}
                                                data-selected={value.preset === preset || undefined}
                                                onClick={() => choosePreset(preset)}>
                                    {presetLabel(preset)}
                                </UnstyledButton>
                            ))}
                            <UnstyledButton className={classes.shortcut}
                                            data-selected={shown.preset === 'CUSTOM' || undefined}
                                            onClick={() => setDraft({preset: 'CUSTOM', start: null, end: null})}>
                                {presetLabel('CUSTOM')}
                            </UnstyledButton>
                        </div>
                        <button type="button" className={classes.clear} disabled={!value.start && !draft}
                                onClick={() => {
                                    setDraft(null);
                                    onChange(NO_DATES);
                                }}>
                            {t`Clear`}
                        </button>
                    </div>
                    <div className={classes.datesSide}>
                        <div className={classes.dateFields}>
                            <DateField label={t`From`} day={shown.start}/>
                            <DateField label={t({message: 'To', context: 'date range'})} day={shown.end ?? (draft ? null : shown.start)}/>
                        </div>
                        <Calendar range={shown} onChange={pickDays}/>
                    </div>
                </div>
            </Popover.Dropdown>
        </Popover>
    );
};

// ── Phone: one « Filtres » button, a sheet from the bottom ─────────────────────────────────────

/** The round filter button at the end of the phone search (Figma 546:3115). */
export const FilterButton = ({active, onClick}: { active: boolean, onClick: () => void }) => (
    <UnstyledButton className={classes.filterButton} data-active={active || undefined} onClick={onClick}
                    aria-label={t`Filters`}>
        <img src={`${ICONS}/filtre.svg`} width={18} height={18} alt=""/>
    </UnstyledButton>
);

/** A multiple-choice capsule of the sheet, its count in an orange bubble. */
export const SheetChips = ({choices, value, onChange, label}: {
    choices: CheckChoice[],
    value: string[],
    onChange: (value: string[]) => void,
    label: string,
}) => (
    <div className={classes.chips} role="group" aria-label={label}>
        {choices.map((choice) => {
            const checked = value.includes(choice.value);
            return (
                <UnstyledButton key={choice.value} className={classes.chip} data-checked={checked || undefined}
                                aria-pressed={checked} onClick={() => onChange(toggled(value, choice.value))}>
                    {choice.label}
                    {choice.count !== undefined && <span className={classes.chipCount}>{choice.count}</span>}
                </UnstyledButton>
            );
        })}
    </div>
);

/** « 7 jours · 30 jours · Personnalisée » and the calendar, in the orders' sheet. */
export const SheetDates = ({value, onChange, onSaleSince}: {
    value: DateRange,
    onChange: (value: DateRange) => void,
    onSaleSince: Dayjs,
}) => {
    const [custom, setCustom] = useState(value.preset === 'CUSTOM');
    const choices: { preset: Exclude<DatePreset, 'CUSTOM' | 'TODAY' | 'SINCE_ON_SALE'>, label: string }[] = [
        {preset: 'LAST_7_DAYS', label: t`7 days`},
        {preset: 'LAST_30_DAYS', label: t`30 days`},
    ];

    return (
        <>
            <div className={classes.chips} role="group" aria-label={t`Dates`}>
                {choices.map(({preset, label}) => (
                    <UnstyledButton key={preset} className={classes.chip} data-checked={value.preset === preset || undefined}
                                    aria-pressed={value.preset === preset}
                                    onClick={() => {
                                        setCustom(false);
                                        onChange(value.preset === preset ? NO_DATES : presetRange(preset, onSaleSince));
                                    }}>
                        {label}
                    </UnstyledButton>
                ))}
                <UnstyledButton className={classes.chip} data-checked={custom || undefined} aria-pressed={custom}
                                onClick={() => {
                                    setCustom(!custom);
                                    if (custom) {
                                        onChange(NO_DATES);
                                    }
                                }}>
                    {t({message: 'Custom', context: 'dates'})}
                </UnstyledButton>
            </div>
            {custom && <Calendar range={value.preset === 'CUSTOM' ? value : NO_DATES} onChange={onChange}/>}
        </>
    );
};

export const FilterSheet = ({opened, onClose, onClear, children}: {
    opened: boolean,
    onClose: () => void,
    onClear: () => void,
    children: ReactNode,
}) => (
    <Drawer opened={opened} onClose={onClose} position="bottom" size="auto" withCloseButton={false}
            classNames={{content: classes.sheet, body: classes.sheetBody}}>
        <span className={classes.sheetHandle} aria-hidden/>
        <div className={classes.sheetHead}>
            <h2 className={classes.sheetTitle}>{t`Filters`}</h2>
            <UnstyledButton className={classes.sheetClose} onClick={onClose} aria-label={t`Close`}>
                <img src="/interface/admin/produits/fermer.svg" width={18} height={18} alt=""/>
            </UnstyledButton>
        </div>
        {children}
        <div className={classes.sheetActions}>
            <UnstyledButton className={classes.sheetClear} onClick={onClear}>{t`Clear`}</UnstyledButton>
            <UnstyledButton className={classes.sheetApply} onClick={onClose}>{t`See the results`}</UnstyledButton>
        </div>
    </Drawer>
);
