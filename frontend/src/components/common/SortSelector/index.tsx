import {Select} from "@mantine/core";
import {t} from "@lingui/macro";
import classes from "./SortSelector.module.scss";
import {SortDirectionLabel} from "../../../types.ts";
import {PublicIcon} from "../PublicIcon";

export interface SortSelectorProps {
    options: Record<string, SortDirectionLabel>,
    onSortSelect: (key: string, sortDirection: string) => void,
    selected: string,
}

// The sort order of a list, in the floating dropdown look of the search field beside it.
export const SortSelector = ({options, onSortSelect, selected}: SortSelectorProps) => {
    const sortOptions = Object.entries(options).flatMap(([key, {asc, desc}]) => {
        const optionsForThisKey = [];
        if (asc) {
            optionsForThisKey.push({value: `${key}:asc`, label: asc});
        }
        if (desc) {
            optionsForThisKey.push({value: `${key}:desc`, label: desc});
        }
        return optionsForThisKey;
    });

    return (
        <div className={classes.selectWrapper}>
            <Select
                size={'md'}
                data={sortOptions}
                className={classes.select}
                classNames={{input: classes.input, section: classes.section}}
                rightSection={<PublicIcon name={'chevron'} size={18}/>}
                rightSectionPointerEvents="none"
                allowDeselect={false}
                aria-label={t`Sort by`}
                comboboxProps={{position: 'bottom-end', width: 'max-content', offset: 10}}
                value={selected}
                onChange={(value) => {
                    if (value) {
                        const [key, sortDirection] = value.split(':');
                        onSortSelect(key, sortDirection);
                    }
                }}
            />
        </div>
    );
}
