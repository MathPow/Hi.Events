import {ComponentPropsWithoutRef, forwardRef, KeyboardEvent, ReactNode, useRef} from "react";
import classNames from "classnames";
import {IconCheck} from "@tabler/icons-react";
import classes from "./Pill.module.scss";

export type PillSize = 'md' | 'sm';

export interface PillProps extends ComponentPropsWithoutRef<'button'> {
    // Chosen: filled in brown. Left undefined, the pill is a plain button (a menu, an action).
    active?: boolean;
    // md: the filters and selectors of the lists (44px); sm: the choices inside a form (40px).
    size?: PillSize;
    leftSection?: ReactNode;
    rightSection?: ReactNode;
    // A bubble after the label (a count), zero included: leave it undefined for none.
    count?: number;
}

/**
 * THE outlined pill of the app: filters, selectors that open a menu, chips, choices. A 2px brown
 * stroke, filled in brown once chosen, cut by hand and boiling on hover like every Dehors button
 * (data-rough="button", useRoughEdges). Never draw an outlined pill by hand: use this one, or
 * PillChoice for one choice among several, so they all look and move the same.
 */
export const Pill = forwardRef<HTMLButtonElement, PillProps>(({
    active,
    size = 'md',
    leftSection,
    rightSection,
    count,
    className,
    children,
    type = 'button',
    ...props
}, ref) => (
    <button
        ref={ref}
        type={type}
        aria-pressed={active}
        {...props}
        className={classNames(classes.pill, className)}
        data-rough="button"
        data-size={size}
        data-active={active || undefined}
    >
        {leftSection}
        {children !== undefined && children !== null && <span className={classes.label}>{children}</span>}
        {count !== undefined && <span className={classes.count}>{count}</span>}
        {rightSection}
    </button>
));

// eslint-disable-next-line lingui/no-unlocalized-strings
Pill.displayName = 'Pill';

export interface PillChoiceOption<T extends string> {
    value: T;
    label: ReactNode;
    // For a pill that only shows an icon: what screen readers say.
    ariaLabel?: string;
    disabled?: boolean;
}

interface PillChoiceProps<T extends string> {
    // Read by screen readers: what is being chosen.
    label: string;
    // null: nothing chosen yet.
    value: T | null;
    options: PillChoiceOption<T>[];
    onChange: (value: T) => void;
    disabled?: boolean;
    // The pills share the whole width, each the same size.
    fullWidth?: boolean;
    size?: PillSize;
    className?: string;
}

/**
 * One choice among pills (« Boucle » / « Point à point », « Pour chaque billet » / « Par commande »):
 * a radio group, the arrows move the choice like any radio. Use it instead of Mantine's
 * SegmentedControl.
 */
export const PillChoice = <T extends string, >({
    label,
    value,
    options,
    onChange,
    disabled,
    fullWidth,
    size = 'sm',
    className,
}: PillChoiceProps<T>) => {
    const group = useRef<HTMLDivElement>(null);
    const enabled = options.filter((option) => !disabled && !option.disabled);
    // The chosen pill takes the focus with Tab; none chosen, the first one.
    const focusable = enabled.find((option) => option.value === value) ?? enabled[0];

    const choose = (option: PillChoiceOption<T>) => {
        if (option.value !== value) {
            onChange(option.value);
        }
    };

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, option: PillChoiceOption<T>) => {
        const step = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[event.key];
        if (!step || enabled.length === 0) {
            return;
        }
        event.preventDefault();
        const at = enabled.findIndex((candidate) => candidate.value === option.value);
        const next = enabled[(at + step + enabled.length) % enabled.length];
        choose(next);
        group.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(next.value)}"]`)?.focus();
    };

    return (
        <div ref={group} className={classNames(classes.choice, className)} role="radiogroup" aria-label={label}
             data-full-width={fullWidth || undefined}>
            {options.map((option) => (
                <Pill
                    key={option.value}
                    role="radio"
                    aria-checked={value === option.value}
                    aria-pressed={undefined}
                    active={value === option.value}
                    size={size}
                    aria-label={option.ariaLabel}
                    title={option.ariaLabel}
                    data-value={option.value}
                    tabIndex={option.value === focusable?.value ? 0 : -1}
                    disabled={disabled || option.disabled}
                    onClick={() => choose(option)}
                    onKeyDown={(event) => onKeyDown(event, option)}
                >
                    {option.label}
                </Pill>
            ))}
        </div>
    );
};

interface PillTogglesProps<T extends string | number> {
    // Read by screen readers: what is being picked.
    label: string;
    // The values switched on.
    value: T[];
    options: { value: T, label: ReactNode }[];
    onToggle: (value: T) => void;
    disabled?: boolean;
    size?: PillSize;
    className?: string;
}

/**
 * Several picks among pills (the tickets a check-in list accepts): each pill switches on and off,
 * a check before the ones switched on.
 */
export const PillToggles = <T extends string | number, >({
    label,
    value,
    options,
    onToggle,
    disabled,
    size = 'sm',
    className,
}: PillTogglesProps<T>) => (
    <div className={classNames(classes.choice, className)} role="group" aria-label={label}>
        {options.map((option) => {
            const checked = value.includes(option.value);
            return (
                <Pill
                    key={option.value}
                    role="checkbox"
                    aria-checked={checked}
                    aria-pressed={undefined}
                    active={checked}
                    size={size}
                    disabled={disabled}
                    leftSection={checked ? <IconCheck size={16} stroke={2.25}/> : undefined}
                    onClick={() => onToggle(option.value)}
                >
                    {option.label}
                </Pill>
            );
        })}
    </div>
);
