import {ActionIcon} from '@mantine/core';
import {IconChevronDown, IconChevronUp} from '@tabler/icons-react';
import {t} from "@lingui/macro";
import classNames from "classnames";
import classes from "./SortArrows.module.scss";

interface SortArrowsProps {
    upArrowEnabled: boolean;
    downArrowEnabled: boolean;
    onSortUp: () => void;
    onSortDown: () => void;
    flexDirection?: 'row' | 'column';
    className?: string;
}

// Move up / move down: two small round buttons, dimmed when the item can't move further.
export const SortArrows = ({
                               upArrowEnabled,
                               downArrowEnabled,
                               onSortUp,
                               onSortDown,
                               flexDirection = 'row',
                               className,
                           }: SortArrowsProps) => {
    return (
        <div className={classNames(classes.arrows, className)} data-direction={flexDirection}>
            <ActionIcon
                className={classes.arrow}
                onClick={onSortUp}
                disabled={!upArrowEnabled}
                variant="subtle"
                aria-label={t`Move up`}
                title={t`Move up`}
            >
                <IconChevronUp size={18} stroke={2.25}/>
            </ActionIcon>
            <ActionIcon
                className={classes.arrow}
                onClick={onSortDown}
                disabled={!downArrowEnabled}
                variant="subtle"
                aria-label={t`Move down`}
                title={t`Move down`}
            >
                <IconChevronDown size={18} stroke={2.25}/>
            </ActionIcon>
        </div>
    );
};
