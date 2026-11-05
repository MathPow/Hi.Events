import type {ComboboxItem, ComboboxLikeRenderOptionInput} from "@mantine/core";
import type {ReactNode} from "react";
import {PublicIcon} from "../PublicIcon";
import classes from "./OptionRow.module.scss";

export const optionRowClasses = classes;

export const OptionCheck = ({checked}: { checked?: boolean }) => (
    <span className={classes.box} data-checked={checked || undefined} aria-hidden>
        {checked && <PublicIcon name={'coche'} size={14}/>}
    </span>
);

/** What a row shows: an optional picture, the label (and its line under it), the box. */
export const OptionContent = ({label, description, illustration, checked}: {
    label: ReactNode,
    description?: ReactNode,
    illustration?: ReactNode,
    checked?: boolean,
}) => (
    <>
        {illustration !== undefined && illustration !== null && <span className={classes.illustration}>{illustration}</span>}
        <span className={classes.label}>
            {label}
            {description && <span className={classes.description}>{description}</span>}
        </span>
        <OptionCheck checked={checked}/>
    </>
);

/** Every Select and MultiSelect draws its options with this (theme.ts). */
export const renderOptionRow = ({option, checked}: ComboboxLikeRenderOptionInput<ComboboxItem>) => (
    <OptionContent label={option.label} checked={checked}/>
);
