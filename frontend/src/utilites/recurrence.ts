import dayjs, {Dayjs} from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

// « Répéter cet événement »: the dates are calendar days in the event's time zone, each one at the
// event's own start time (RecurringEventDateService::MAX_OCCURRENCES on the server).
export type RepeatFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export type RepeatEnd = { type: 'COUNT', count: number } | { type: 'UNTIL', until: string };

export const MAX_REPEATED_DATES = 26;

// The fifth weekday of a month becomes « the last » one, as not every month has five.
export const LAST_WEEK_OF_MONTH = 5;

const DAY = 'YYYY-MM-DD';

export interface RepeatedDates {
    dates: string[];
    // An end date further than MAX_REPEATED_DATES dates: only the first ones are kept.
    truncated: boolean;
}

// The event's day in its time zone, « 2026-11-03 ».
export const eventLocalDay = (startDate: string, timezone: string) => dayjs.utc(startDate).tz(timezone).format(DAY);

// 2 for the second Tuesday of its month, LAST_WEEK_OF_MONTH for a fifth one.
export const weekOfMonth = (day: string) => Math.min(Math.ceil(dayjs.utc(day).date() / 7), LAST_WEEK_OF_MONTH);

const nthWeekdayOfMonth = (month: Dayjs, weekday: number, week: number): Dayjs => {
    if (week >= LAST_WEEK_OF_MONTH) {
        const last = month.endOf('month').startOf('day');
        return last.subtract((last.day() - weekday + 7) % 7, 'day');
    }
    const first = month.startOf('month');
    return first.add((weekday - first.day() + 7) % 7 + (week - 1) * 7, 'day');
};

// The index-th date after the event's day (dates are handled as UTC days: no DST shift).
const nthDate = (first: Dayjs, frequency: RepeatFrequency, index: number): Dayjs => {
    if (frequency === 'WEEKLY') {
        return first.add(index * 7, 'day');
    }
    if (frequency === 'BIWEEKLY') {
        return first.add(index * 14, 'day');
    }
    return nthWeekdayOfMonth(first.add(index, 'month'), first.day(), weekOfMonth(first.format(DAY)));
};

// The start of a day at the event's start time, as an instant.
export const occurrenceStart = (day: string, startDate: string, timezone: string): Dayjs => {
    // eslint-disable-next-line lingui/no-unlocalized-strings
    const time = dayjs.utc(startDate).tz(timezone).format('HH:mm:ss');
    return dayjs.tz(`${day} ${time}`, timezone);
};

/**
 * The next dates of an event, after its own and not already past: `count` of them, or up to
 * `until` (included), never more than MAX_REPEATED_DATES.
 */
export const repeatedDates = (
    startDate: string,
    timezone: string,
    frequency: RepeatFrequency,
    end: RepeatEnd,
    now: Dayjs = dayjs(),
): RepeatedDates => {
    const first = dayjs.utc(eventLocalDay(startDate, timezone));
    const wanted = end.type === 'COUNT' ? Math.min(Math.max(Math.floor(end.count), 0), MAX_REPEATED_DATES) : MAX_REPEATED_DATES + 1;
    const dates: string[] = [];

    // A safety bound: an old event's past dates are skipped, not counted.
    for (let index = 1; dates.length < wanted && index <= 1000; index++) {
        const day = nthDate(first, frequency, index).format(DAY);
        if (end.type === 'UNTIL' && day > end.until) {
            break;
        }
        if (occurrenceStart(day, startDate, timezone).isAfter(now)) {
            dates.push(day);
        }
    }

    return {
        dates: dates.slice(0, MAX_REPEATED_DATES),
        truncated: dates.length > MAX_REPEATED_DATES,
    };
};
