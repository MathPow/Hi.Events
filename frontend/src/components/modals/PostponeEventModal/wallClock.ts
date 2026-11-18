import dayjs from "dayjs";
import {intlLocale} from "../../../utilites/intlLocale.ts";

// eslint-disable-next-line lingui/no-unlocalized-strings
export const WALL_CLOCK = 'YYYY-MM-DDTHH:mm';

// « samedi 21 novembre à 09 h 00 »: a wall-clock date of the event (« 2026-11-21T09:00 »), in its own time.
export const formatWallClock = (value: string | null | undefined) => {
    if (!value || !dayjs(value).isValid()) {
        return '';
    }

    return new Intl.DateTimeFormat(intlLocale(), {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: 'numeric',
        minute: '2-digit',
    }).format(dayjs(value).toDate());
};
