import {t} from "@lingui/macro";
import {intlLocale} from "./intlLocale.ts";

// « Heure de l'Est (Québec) »: the name of the time zone in the page's language, and a place people know.
export const timezoneLabel = (timezone: string) => {
    let name = '';
    try {
        name = new Intl.DateTimeFormat(intlLocale(), {timeZone: timezone, timeZoneName: 'longGeneric'})
            .formatToParts(new Date())
            .find(part => part.type === 'timeZoneName')?.value ?? '';
    } catch {
        return timezone;
    }
    const place = timezone === 'America/Toronto' ? t`Quebec` : timezone.split('/').pop()?.replace(/_/g, ' ');
    return name ? `${name.charAt(0).toUpperCase()}${name.slice(1)} (${place})` : timezone;
};
