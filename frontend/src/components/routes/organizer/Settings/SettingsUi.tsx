import {ReactNode, useId} from "react";
import {Switch} from "@mantine/core";
import {UseFormReturnType} from "@mantine/form";
import {t} from "@lingui/macro";
import classNames from "classnames";
import {intlLocale} from "../../../../utilites/intlLocale.ts";
import classes from "./Settings.module.scss";

interface SettingsCardProps {
    // An anchor (…/settings/payment#platform-fees).
    id?: string;
    title: ReactNode;
    subtitle?: ReactNode;
    action?: ReactNode;
    full?: boolean;
    className?: string;
    children?: ReactNode;
}

// A section of the bento layout: half width unless `full`.
export const SettingsCard = ({id, title, subtitle, action, full, className, children}: SettingsCardProps) => (
    <section id={id} className={classNames(classes.card, {[classes.full]: full}, className)}>
        <div className={classes.cardHead}>
            <div className={classes.cardHeadText}>
                <h2 className={classes.cardTitle}>{title}</h2>
                {subtitle && <p className={classes.cardSubtitle}>{subtitle}</p>}
            </div>
            {action}
        </div>
        {children}
    </section>
);

interface PillChoiceProps<T extends string> {
    label: string;
    value: T | null;
    options: { value: T, label: string }[];
    onChange: (value: T) => void;
    disabled?: boolean;
}

// « Pour chaque billet » / « Par commande »: one choice among pills.
export const PillChoice = <T extends string, >({label, value, options, onChange, disabled}: PillChoiceProps<T>) => (
    <div className={classes.pills} role="radiogroup" aria-label={label}>
        {options.map(option => (
            <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={value === option.value}
                className={classes.pill}
                disabled={disabled}
                onClick={() => value !== option.value && onChange(option.value)}
            >
                {option.label}
            </button>
        ))}
    </div>
);

interface ToggleRowProps {
    label: string;
    hint?: ReactNode;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}

export const ToggleRow = ({label, hint, checked, onChange, disabled}: ToggleRowProps) => {
    const id = useId();

    return (
        <div className={classes.toggleRow}>
            <span className={classes.toggleText}>
                <span className={classes.toggleLabel} id={`${id}-label`}>{label}</span>
                {hint && <span className={classes.toggleHint} id={`${id}-hint`}>{hint}</span>}
            </span>
            <Switch
                className={classes.switch}
                withThumbIndicator={false}
                checked={checked}
                disabled={disabled}
                aria-labelledby={`${id}-label`}
                aria-describedby={hint ? `${id}-hint` : undefined}
                onChange={(event) => onChange(event.currentTarget.checked)}
            />
        </div>
    );
};

export type TagTone = 'green' | 'yellow' | 'neutral' | 'ink';

export const Tag = ({tone, children}: { tone: TagTone, children: ReactNode }) => (
    <span className={classNames(classes.tag, {
        [classes.tagGreen]: tone === 'green',
        [classes.tagYellow]: tone === 'yellow',
        [classes.tagNeutral]: tone === 'neutral',
        [classes.tagInk]: tone === 'ink',
    })}>
        {children}
    </span>
);

// The server answers « validation.url » when its messages are missing in the page's language.
export const serverMessage = (messages: string | string[]) => {
    const message = Array.isArray(messages) ? messages[0] : messages;
    if (!message?.startsWith('validation.')) {
        return message;
    }
    const rule = message.slice('validation.'.length).split('.')[0];
    const known: Record<string, string> = {
        required: t`This field is required.`,
        email: t`Enter a valid email address.`,
        url: t`Enter a full address, starting with https://`,
        max: t`This is too long.`,
    };
    return known[rule] ?? t`This value is not valid.`;
};

// Laravel's validation errors (« name »: ["…"]) on the fields they concern; other errors are left to
// the « Pas enregistré · Réessayer » of the top bar.
export const showServerErrors = (form: UseFormReturnType<any>, error: any) => {
    const errors = error?.response?.data?.errors as Record<string, string | string[]> | undefined;
    if (!errors) {
        return;
    }
    form.setErrors(Object.fromEntries(Object.entries(errors).map(([field, messages]) => [field, serverMessage(messages)])));
};

// « Dollar canadien (CAD) », « Canada »: names in the language of the page.
export const currencyName = (code: string, fallback: string) => {
    try {
        const name = new Intl.DisplayNames([intlLocale()], {type: 'currency'}).of(code);
        return name && name !== code ? `${name.charAt(0).toUpperCase()}${name.slice(1)} (${code})` : fallback;
    } catch {
        return fallback;
    }
};

export const countryName = (code: string, fallback: string) => {
    try {
        return new Intl.DisplayNames([intlLocale()], {type: 'region'}).of(code) ?? fallback;
    } catch {
        return fallback;
    }
};
