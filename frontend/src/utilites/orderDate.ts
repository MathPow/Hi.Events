import {t} from "@lingui/macro";
import {useLingui} from "@lingui/react";

// French dates read « 27 oct. » and « 9 h 12 » the Quebec way.
const intlLocale = (locale: string) => locale.startsWith('fr') ? 'fr-CA' : locale;

/** When an order was placed: « Aujourd'hui, 9 h 12 », « Hier, 18 h », then « 27 oct. ». */
export const useOrderDate = () => {
    const {i18n} = useLingui();
    const locale = intlLocale(i18n.locale);

    return (value: string) => {
        const date = new Date(value);
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const time = new Intl.DateTimeFormat(locale, {hour: 'numeric', minute: '2-digit'}).format(date);

        if (date.toDateString() === now.toDateString()) {
            return `${t`Today`}, ${time}`;
        }
        if (date.toDateString() === yesterday.toDateString()) {
            return `${t`Yesterday`}, ${time}`;
        }
        return new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'short',
            ...(date.getFullYear() !== now.getFullYear() ? {year: 'numeric'} : {}),
        }).format(date);
    };
};
