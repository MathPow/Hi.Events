import {Event} from "../types.ts";
import {intlLocale} from "./intlLocale.ts";

// « sam. 7 nov. · 9 h » (« sam. 7 nov. 2026 · 9 h 30 » with the year), in the event's time zone.
export const eventStartLabel = (event: Pick<Event, 'start_date' | 'timezone'>, withYear = false) => {
    if (!event.start_date) {
        return '';
    }
    const date = new Date(event.start_date);
    const timeZone = event.timezone || undefined;
    const day = new Intl.DateTimeFormat(intlLocale(), {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        ...(withYear ? {year: 'numeric'} : {}),
        timeZone,
    }).format(date);

    return `${day} · ${clockTime(date, timeZone)}`;
};

// « 9 h » on the hour, « 9 h 30 » otherwise (« 9 a.m. », « 9:30 a.m. » in English). The hour alone
// would come out « 09 h » in fr-CA, so the minutes are formatted then left out.
export const clockTime = (date: Date, timeZone: string | undefined) => {
    const onTheHour = Number(new Intl.DateTimeFormat('en', {minute: 'numeric', timeZone}).format(date)) === 0;
    const parts = new Intl.DateTimeFormat(intlLocale(), {hour: 'numeric', minute: '2-digit', timeZone}).formatToParts(date);
    if (!onTheHour) {
        return parts.map((part) => part.value).join('');
    }
    const minuteIndex = parts.findIndex((part) => part.type === 'minute');
    const short = parts
        .filter((part, index) => index !== minuteIndex
            && !(index === minuteIndex - 1 && part.type === 'literal' && /^[:.]$/.test(part.value.trim())))
        .map((part) => part.value)
        .join('')
        .replace(/\s+/g, ' ')
        .trim();

    // A bare « 9 » (24-hour languages without « h ») would not read as a time: keep « 9:00 » there.
    return /^\d+$/.test(short) ? parts.map((part) => part.value).join('') : short;
};
