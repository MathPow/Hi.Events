import {t} from "@lingui/macro";
import {Event, EventSettings} from "../../../types.ts";
import {formatAddress, isAddressSet} from "../../../utilites/addressUtilities.ts";
import {formatDateWithLocale} from "../../../utilites/dates.ts";
import {eventHomepageUrl} from "../../../utilites/urlHelper.ts";

export type ReminderTemplate = 'week_before' | 'day_before';

const escape = (text: string) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// What the organizer still has to write, set apart so it isn't sent as is.
const toFill = (text: string) => `<strong>[${escape(text)}]</strong>`;

const whereBlock = (settings?: EventSettings) => {
    const location = settings?.location_details;
    if (!location || (!location.venue_name && !isAddressSet(location))) {
        return `<p>${toFill(t`Meeting place`)}</p>`;
    }
    const address = isAddressSet(location) ? formatAddress(location) : '';
    const mapsUrl = settings?.maps_url
        || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || location.venue_name || '')}`;
    const lines = [location.venue_name, address].filter(Boolean).map(line => escape(line as string));

    return `<p>${lines.join('<br>')}<br><a href="${escape(mapsUrl)}">${t`Get directions`}</a></p>`;
};

/**
 * A reminder ready to send before an outing or a race: the date, the meeting
 * place and the event's link are filled in, the gear and the weather are left
 * for the organizer to write.
 */
export const buildReminder = (template: ReminderTemplate, event: Event, settings?: EventSettings) => {
    const title = escape(event.title);
    const when = escape(formatDateWithLocale(event.start_date, 'fullDateTime', event.timezone));
    const time = escape(formatDateWithLocale(event.start_date, 'timeOnly', event.timezone));
    const eventLink = `<p><a href="${escape(eventHomepageUrl(event))}">${t`All the event's details`}</a></p>`;

    if (template === 'week_before') {
        return {
            subject: t`${event.title}: one week to go`,
            message: [
                `<p>${t`Hi!`}</p>`,
                `<p>${t`${title} is in one week. Here's what you need to know to get ready.`}</p>`,
                `<h3>${t`When`}</h3><p>${when}</p>`,
                `<h3>${t`Where`}</h3>${whereBlock(settings)}`,
                `<h3>${t`Required gear`}</h3><ul><li>${toFill(t`Item to bring`)}</li></ul>`,
                `<h3>${t`To plan ahead`}</h3><p>${toFill(t`Parking, carpooling, bib pick-up`)}</p>`,
                eventLink,
            ].join(''),
        };
    }

    return {
        subject: t`Tomorrow: ${event.title}`,
        message: [
            `<p>${t`Hi!`}</p>`,
            `<p>${t`See you tomorrow at ${time} for ${title}.`}</p>`,
            `<h3>${t`Where`}</h3>${whereBlock(settings)}`,
            `<h3>${t`Weather`}</h3><p>${toFill(t`Expected weather and what to wear`)}</p>`,
            `<h3>${t`Required gear`}</h3><ul><li>${toFill(t`Item to bring`)}</li></ul>`,
            eventLink,
        ].join(''),
    };
};
