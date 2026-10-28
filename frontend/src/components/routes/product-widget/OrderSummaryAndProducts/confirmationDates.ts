import dayjs from "dayjs";
import {formatDateWithLocale} from "../../../../utilites/dates.ts";
import {localeFormats} from "../../../../utilites/dateLocales.ts";
import {getClientLocale} from "../../../../locales.ts";

// Dates courtes de la maquette (« Ven. 30 oct. », « 18 h »), dans le fuseau de l'evenement.
const currentLocale = (): string => {
    const locale = getClientLocale();
    return locale in localeFormats ? locale : 'en';
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const inZone = (date: string, timezone: string) => dayjs.utc(date).tz(timezone).locale(currentLocale());

export const shortDayLabel = (date: string, timezone: string, capitalized = true): string => {
    const locale = currentLocale();
    const format = locale === 'en' ? 'ddd, MMM D' : 'ddd D MMM';
    const label = inZone(date, timezone).format(format);

    return capitalized ? capitalize(label) : label;
};

export const shortTimeLabel = (date: string, timezone: string): string => {
    const locale = currentLocale();

    if (locale === 'fr') {
        return inZone(date, timezone).format('H [h] mm').replace(/ h 00$/, ' h');
    }

    if (locale === 'en') {
        return inZone(date, timezone).format('h:mm A').replace(':00', '');
    }

    return formatDateWithLocale(date, 'timeOnly', timezone, locale);
};

// « Ven. 30 oct., 18 h → sam. 31 oct., 16 h », ou « Ven. 30 oct., 18 h → 21 h » le meme jour.
export const eventRangeLabel = (startDate: string, endDate: string | undefined, timezone: string): string => {
    const start = `${shortDayLabel(startDate, timezone)}, ${shortTimeLabel(startDate, timezone)}`;

    if (!endDate) {
        return start;
    }

    const sameDay = inZone(startDate, timezone).format('YYYY-MM-DD') === inZone(endDate, timezone).format('YYYY-MM-DD');
    const end = sameDay
        ? shortTimeLabel(endDate, timezone)
        : `${shortDayLabel(endDate, timezone, false)}, ${shortTimeLabel(endDate, timezone)}`;

    return `${start} → ${end}`;
};

// Le nom du fuseau dans la langue du visiteur (« Heure d'été de l'Est »), sinon son identifiant.
export const timezoneLabel = (date: string, timezone: string): string => {
    try {
        const name = new Intl.DateTimeFormat(getClientLocale(), {timeZone: timezone, timeZoneName: 'long'})
            .formatToParts(new Date(dayjs.utc(date).valueOf()))
            .find((part) => part.type === 'timeZoneName')?.value;

        return name ? capitalize(name) : timezone;
    } catch {
        return timezone;
    }
};
