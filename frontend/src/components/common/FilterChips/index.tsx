import {useEffect, useRef} from "react";
import classNames from "classnames";
import {Pill} from "../Pill";
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

// Quick filters of a list, like the tabs of the organizer's events page: pills (Pill), the chosen
// one filled in brown, an optional count bubble.
export function FilterChips<T extends string>({chips, value, onChange, label, className}: FilterChipsProps<T>) {
    const rowRef = useRef<HTMLDivElement>(null);

    // Phones: the row scrolls sideways; the chosen chip is brought into view (sideways only).
    useEffect(() => {
        const row = rowRef.current;
        const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
        if (!row || !chip || row.scrollWidth <= row.clientWidth) {
            return;
        }
        const rowBox = row.getBoundingClientRect();
        const chipBox = chip.getBoundingClientRect();
        if (chipBox.right > rowBox.right) {
            row.scrollLeft += chipBox.right - rowBox.right + 16;
        } else if (chipBox.left < rowBox.left) {
            row.scrollLeft -= rowBox.left - chipBox.left + 16;
        }
    }, [value]);

    return (
        <div ref={rowRef} className={classNames(classes.chips, className)} role="group" aria-label={label}>
            {chips.map((chip) => (
                <Pill key={chip.value} active={chip.value === value} count={chip.count || undefined}
                      onClick={() => onChange(chip.value)}>
                    {chip.label}
                </Pill>
            ))}
        </div>
    );
}
