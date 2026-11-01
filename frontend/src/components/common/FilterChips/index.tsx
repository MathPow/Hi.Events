import classNames from "classnames";
import classes from "./FilterChips.module.scss";

export interface FilterChip<T extends string> {
    value: T;
    label: string;
    // The count bubble, shown when above zero.
    count?: number;
}

interface FilterChipsProps<T extends string> {
    chips: FilterChip<T>[];
    // null when the current filters match no chip (set from the filters popup).
    value: T | null;
    onChange: (value: T) => void;
    label: string;
    className?: string;
}

// Quick filters of a list, like the tabs of the organizer's events page: outlined chips, the chosen
// one filled in brown, an optional count bubble.
export function FilterChips<T extends string>({chips, value, onChange, label, className}: FilterChipsProps<T>) {
    return (
        <div className={classNames(classes.chips, className)} role="group" aria-label={label}>
            {chips.map((chip) => (
                <button
                    key={chip.value}
                    type="button"
                    className={classes.chip}
                    aria-pressed={chip.value === value}
                    onClick={() => onChange(chip.value)}
                >
                    {chip.label}
                    {!!chip.count && <span className={classes.count}>{chip.count}</span>}
                </button>
            ))}
        </div>
    );
}
