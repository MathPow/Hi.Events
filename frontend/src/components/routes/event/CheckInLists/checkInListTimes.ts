import {t} from "@lingui/macro";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import {CheckInList} from "../../../../types.ts";
import {intlLocale} from "../../../../utilites/intlLocale.ts";
import {clockTime} from "../../../../utilites/eventStartLabel.ts";

dayjs.extend(utc);

// The lists' dates come from the API in UTC (« 2026-11-07 11:00:00 »).
const parse = (value?: string | null) => value ? dayjs.utc(value).toDate() : null;

const dayOf = (date: Date, timeZone?: string) =>
    new Intl.DateTimeFormat(intlLocale(), {day: 'numeric', month: 'short', timeZone}).format(date);

const sameDay = (a: Date, b: Date, timeZone?: string) => dayOf(a, timeZone) === dayOf(b, timeZone);

/**
 * When a list is open, in the event's time zone: « 7 nov. · 7 h à 11 h », « Ouvre le 7 nov. à 6 h »,
 * « Fermée le 7 nov. », or « Toujours ouverte » without dates.
 */
export const listTimes = (list: CheckInList, timeZone?: string) => {
    const opens = parse(list.activates_at);
    const closes = parse(list.expires_at);

    if (list.is_expired && closes) {
        const day = dayOf(closes, timeZone);
        return t`Closed on ${day}`;
    }
    if (!list.is_active && opens) {
        const day = dayOf(opens, timeZone);
        const time = clockTime(opens, timeZone);
        return t`Opens on ${day} at ${time}`;
    }
    if (opens && closes) {
        const day = dayOf(opens, timeZone);
        const start = clockTime(opens, timeZone);
        const end = sameDay(opens, closes, timeZone)
            ? clockTime(closes, timeZone)
            : `${dayOf(closes, timeZone)} ${clockTime(closes, timeZone)}`;
        return t`${day} · ${start} to ${end}`;
    }
    if (closes) {
        const day = dayOf(closes, timeZone);
        const time = clockTime(closes, timeZone);
        return t`Until ${day} at ${time}`;
    }
    return t`Always open`;
};

// The next list to open (not open yet, not closed), for « 1 autre à 6 h le 7 nov. ».
export const nextOpening = (lists: CheckInList[], timeZone?: string) => {
    const upcoming = lists
        .filter((list) => !list.is_active && !list.is_expired && list.activates_at)
        .sort((a, b) => (a.activates_at ?? '').localeCompare(b.activates_at ?? ''));
    const first = parse(upcoming[0]?.activates_at);

    return first
        ? {count: upcoming.length, time: clockTime(first, timeZone), day: dayOf(first, timeZone)}
        : null;
};
