import {ComponentPropsWithoutRef, forwardRef, ReactNode, useState} from "react";
import {Popover, TextInput, UnstyledButton} from "@mantine/core";
import {t} from "@lingui/macro";
import dayjs, {Dayjs} from "dayjs";
import {EVENT_TYPES, eventTypeLabel} from "../../../constants/eventTypes.ts";
import {AccountEventType, Event} from "../../../types.ts";
import {PublicIcon} from "../PublicIcon";
import {EventTypeIllustration} from "../EventTypeIllustration";
import classes from './EventFilters.module.scss';

/**
 * The search field and the two floating dropdowns (dates, types) of the public events directory
 * (Figma « Public · Répertoire d'événements »), also used by the organizer's events page.
 */

export type DateRange = 'ALL' | 'TODAY' | 'WEEKEND' | 'NEXT_7_DAYS' | 'THIS_MONTH';

export const DATE_RANGES: DateRange[] = ['ALL', 'TODAY', 'WEEKEND', 'NEXT_7_DAYS', 'THIS_MONTH'];

export const dateRangeLabel = (range: DateRange) => ({
    ALL: t`All dates`,
    TODAY: t`Today`,
    WEEKEND: t`This weekend`,
    NEXT_7_DAYS: t`Next 7 days`,
    THIS_MONTH: t`This month`,
})[range];

// Les bornes d'une periode, a l'heure de l'appareil. La fin de semaine: le samedi et le
// dimanche qui viennent (le dimanche, la veille et ce jour-la).
export const rangeBounds = (range: Exclude<DateRange, 'ALL'>): [Dayjs, Dayjs] => {
    const now = dayjs();

    switch (range) {
        case 'TODAY':
            return [now.startOf('day'), now.endOf('day')];
        case 'WEEKEND': {
            const saturday = now.day() === 0 ? now.subtract(1, 'day') : now.add(6 - now.day(), 'day');
            return [saturday.startOf('day'), saturday.add(1, 'day').endOf('day')];
        }
        case 'NEXT_7_DAYS':
            return [now.startOf('day'), now.add(6, 'day').endOf('day')];
        case 'THIS_MONTH':
            return [now.startOf('month'), now.endOf('month')];
    }
};

// Pendant la periode: commence avant sa fin, finit apres son debut (8 h sans fin, comme les cartes).
export const isDuring = (event: Event, [from, to]: [Dayjs, Dayjs]) => {
    const start = dayjs.utc(event.start_date);
    const end = event.end_date ? dayjs.utc(event.end_date) : start.add(8, 'hour');

    return !start.isAfter(to) && !end.isBefore(from);
};

// Une case du menu deroulant: la vraie case (cochee ou radio) reste au clavier, cachee sous la rangee.
const MenuOption = ({type, name, checked, onChange, illustration, label}: {
    type: 'checkbox' | 'radio',
    name: string,
    checked: boolean,
    onChange: () => void,
    illustration?: ReactNode,
    label: string,
}) => (
    <label className={classes.option} data-checked={checked || undefined}>
        <input type={type} name={name} checked={checked} onChange={onChange} className={classes.optionInput}/>
        {illustration !== undefined && <span className={classes.optionIllustration}>{illustration}</span>}
        <span className={classes.optionLabel}>{label}</span>
        <span className={classes.box} aria-hidden>
            {checked && <PublicIcon name={'coche'} size={14}/>}
        </span>
    </label>
);

// Le bouton d'un menu deroulant (dates, types), sous son ombre: la decoupe la couperait.
// Popover.Target lui passe sa ref et ses attributs aria.
const MenuTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'> & {
    opened: boolean,
    active: boolean,
}>(({opened, active, children, ...others}, ref) => (
    <div className={classes.shadow}>
        <UnstyledButton ref={ref} {...others} className={classes.trigger} data-rough="button"
                        data-active={opened || active || undefined}>
            <span className={classes.triggerLabel}>{children}</span>
            <PublicIcon name={'chevron'} size={18} className={classes.chevron}/>
        </UnstyledButton>
    </div>
));

export const SearchInput = ({value, onChange, placeholder, label, compact = false}: {
    value: string,
    onChange: (value: string) => void,
    placeholder: string,
    label: string,
    compact?: boolean,
}) => (
    <div className={classes.shadow}>
        <TextInput type="search" value={value} onChange={(event) => onChange(event.currentTarget.value)}
                   placeholder={placeholder}
                   aria-label={label}
                   leftSection={<PublicIcon name={'recherche'} size={compact ? 18 : 20}/>}
                   leftSectionPointerEvents="none"
                   classNames={{root: classes.searchRoot, input: classes.searchInput, section: classes.searchIcon}}/>
    </div>
);

export const DatesMenu = ({value, onChange}: { value: DateRange, onChange: (value: DateRange) => void }) => {
    const [opened, setOpened] = useState(false);

    return (
        <Popover opened={opened} onChange={setOpened} position="bottom-end" offset={10} width={300}
                 trapFocus classNames={{dropdown: classes.menu}}>
            <Popover.Target>
                <MenuTrigger opened={opened} active={value !== 'ALL'} onClick={() => setOpened((current) => !current)}>
                    {value === 'ALL' ? (
                        <>
                            <span className={classes.longLabel}>{t`All dates`}</span>
                            <span className={classes.shortLabel}>{t`Dates`}</span>
                        </>
                    ) : dateRangeLabel(value)}
                </MenuTrigger>
            </Popover.Target>
            <Popover.Dropdown>
                <div role="radiogroup" aria-label={t`Dates`} className={classes.options}>
                    {DATE_RANGES.map((range) => (
                        <MenuOption key={range} type={'radio'} name={'dates'} checked={value === range}
                                    label={dateRangeLabel(range)}
                                    onChange={() => {
                                        onChange(range);
                                        setOpened(false);
                                    }}/>
                    ))}
                </div>
            </Popover.Dropdown>
        </Popover>
    );
};

// Plusieurs types a la fois: chaque case filtre tout de suite, le menu reste ouvert pour en cocher
// d'autres. Aucun type, ou tous, c'est « Tous ».
export const TypesMenu = ({value, onChange}: {
    value: AccountEventType[],
    onChange: (value: AccountEventType[]) => void,
}) => {
    const [opened, setOpened] = useState(false);

    const toggle = (type: AccountEventType) => {
        const next = value.includes(type) ? value.filter((item) => item !== type) : [...value, type];
        onChange(next.length === EVENT_TYPES.length ? [] : EVENT_TYPES.filter((item) => next.includes(item)));
    };

    const count = value.length;

    return (
        <Popover opened={opened} onChange={setOpened} position="bottom-end" offset={10} width={300}
                 trapFocus classNames={{dropdown: classes.menu}}>
            <Popover.Target>
                <MenuTrigger opened={opened} active={value.length > 0} onClick={() => setOpened((current) => !current)}>
                    <PublicIcon name={'filtres'} size={18} className={classes.accentIcon}/>
                    {value.length === 0 && (
                        <>
                            <span className={classes.longLabel}>{t`All types`}</span>
                            <span className={classes.shortLabel}>{t`Types`}</span>
                        </>
                    )}
                    {value.length === 1 && eventTypeLabel(value[0])}
                    {count > 1 && t`${count} types`}
                </MenuTrigger>
            </Popover.Target>
            <Popover.Dropdown>
                <div role="group" aria-label={t`Types`} className={classes.options}>
                    <MenuOption type={'checkbox'} name={'types'} checked={value.length === 0} illustration={null}
                                label={t({message: 'All', context: 'event types'})} onChange={() => onChange([])}/>
                    {EVENT_TYPES.map((type) => (
                        <MenuOption key={type} type={'checkbox'} name={'types'} checked={value.includes(type)}
                                    illustration={<EventTypeIllustration type={type}/>}
                                    label={eventTypeLabel(type)} onChange={() => toggle(type)}/>
                    ))}
                </div>
            </Popover.Dropdown>
        </Popover>
    );
};
