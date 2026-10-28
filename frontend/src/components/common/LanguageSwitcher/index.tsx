import {Select, SelectProps} from "@mantine/core";
import {dynamicActivateLocale, getClientLocale, localeToNameMap, SupportedLocales} from "../../../locales.ts";
import {t} from "@lingui/macro";
import {IconWorld} from "@tabler/icons-react";
import {useLingui} from "@lingui/react";
import {ReactNode} from "react";

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

export const LanguageSwitcher = ({
    classNames,
    comboboxProps,
    checkIconPosition,
    onDropdownOpen,
    iconColor = '#ccc',
    locales,
    leftSection,
    rightSection,
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
}) => {
    useLingui();

    return (
        <>
            <Select
                leftSection={leftSection === undefined ? <IconWorld size={15} color={iconColor}/> : leftSection}
                rightSection={rightSection}
                classNames={classNames}
                comboboxProps={comboboxProps}
                checkIconPosition={checkIconPosition}
                onDropdownOpen={onDropdownOpen}
                aria-label={t`Language`}
                width={180}
                size={'xs'}
                required
                data={(locales ?? Object.keys(localeToNameMap)).map(locale => ({
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
