import {Select, SelectProps} from "@mantine/core";
import {availableLocales, dynamicActivateLocale, getClientLocale, SupportedLocales} from "../../../locales.ts";
import {t} from "@lingui/macro";
import {IconWorld} from "@tabler/icons-react";
import {useLingui} from "@lingui/react";
import {ReactNode} from "react";
import {roughEdgeClipPath} from "../../../utilites/roughEdge.ts";
import classes from "./LanguageSwitcher.module.scss";

// Ideally these would be in the locales.ts file, but when they're there they don't translate.
// Called at render time, so the active catalog is loaded.
export const getLocaleLabel = (locale: SupportedLocales): string => {
    switch (locale) {
        case "hu":
            return t`Hungarian`;
        case "de":
            return t`German`;
        case "en":
            return t`English`;
        case "es":
            return t`Spanish`;
        case "fr":
            return t`French`;
        case "it":
            return t`Italian`;
        case "nl":
            return t`Dutch`;
        case "pt":
            return t`Portuguese`;
        case "pt-br":
            return t`Brazilian Portuguese`;
        case "zh-cn":
            return t`Chinese (Simplified)`;
        case "zh-hk":
            return t`Chinese (Traditional)`;
        case "vi":
            return t`Vietnamese`;
        case "tr":
            return t`Turkish`;
        case "pl":
            return t`Polish`;
        case "se":
            return t`Swedish`;
        case "sk":
            return t`Slovak`;
        case "el":
            return t`Greek`;
        default:
            // Defensive fallback: if a new locale is added to SupportedLocales
            // but not handled here, return the locale code itself rather than
            // undefined. An undefined label propagates into Mantine's Combobox
            // `defaultOptionsFilter`, which calls `.toLowerCase()` on it and
            // throws during SSR, 500-ing every auth page.
            return locale;
    }
};

// Remembers the choice in the locale cookie, then reloads the page in that language.
export const switchLocale = (locale: string) => {
    document.cookie = `locale=${locale};path=/;max-age=31536000`;
    dynamicActivateLocale(locale).finally(() => {
        window.location.href = window.location.pathname + window.location.search;
    });
};

const LIST_SEED = 0x5eed;

// La liste ouverte, decoupee comme les menus de la boutique DEHORS; Mantine la rend dans un portail.
const cutList = () => requestAnimationFrame(() => {
    const list = document.querySelector<HTMLElement>(`.${classes.options}`);
    if (!list?.offsetWidth) {
        return;
    }
    const radius = parseFloat(getComputedStyle(list).borderTopLeftRadius) || 0;
    list.style.clipPath = roughEdgeClipPath(list.offsetWidth, list.offsetHeight,
        {radius, step: 40, amplitude: 1.5, seed: LIST_SEED});
});

export const LanguageSwitcher = ({
    classNames,
    comboboxProps,
    checkIconPosition,
    onDropdownOpen,
    iconColor = '#ccc',
    locales,
    leftSection,
    rightSection,
    dehorsList,
}: {
    classNames?: SelectProps['classNames'];
    comboboxProps?: SelectProps['comboboxProps'];
    checkIconPosition?: SelectProps['checkIconPosition'];
    onDropdownOpen?: SelectProps['onDropdownOpen'];
    iconColor?: string;
    locales?: SupportedLocales[];
    // null retire l'icone du globe; absent, on la garde
    leftSection?: ReactNode | null;
    rightSection?: ReactNode;
    // La liste du site DEHORS (LanguageSwitcher.module.scss), sous le champ, a droite.
    dehorsList?: boolean;
}) => {
    useLingui();

    return (
        <>
            <Select
                leftSection={leftSection === undefined ? <IconWorld size={15} color={iconColor}/> : leftSection}
                rightSection={rightSection}
                classNames={dehorsList ? {
                    ...(classNames as Record<string, string>),
                    dropdown: classes.dropdown,
                    options: classes.options,
                    option: classes.option,
                } : classNames}
                comboboxProps={dehorsList
                    ? {width: 'max-content', position: 'bottom-end', offset: 8, ...comboboxProps}
                    : comboboxProps}
                checkIconPosition={dehorsList ? 'right' : checkIconPosition}
                onDropdownOpen={dehorsList ? cutList : onDropdownOpen}
                aria-label={t`Language`}
                width={180}
                size={'xs'}
                required
                data={(locales ?? availableLocales).map(locale => ({
                    value: locale,
                    label: getLocaleLabel(locale as SupportedLocales),
                }))}
                defaultValue={getClientLocale()}
                placeholder={t`English`}
                onChange={(value) => value && switchLocale(value)}
            />
        </>
    )
}
