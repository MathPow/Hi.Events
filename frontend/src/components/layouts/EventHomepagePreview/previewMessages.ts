import {Event} from "../../../types.ts";

// The draft of the event's page, sent by the homepage designer (routes/event/HomepageDesigner) to this
// iframe. cover: the url of the cover as it will be published, null when it is removed. gallery: the
// urls of the photos as they will be published.
export interface EventPreviewDraft {
    event?: Partial<Pick<Event, 'title' | 'description'>>;
    accent?: string;
    cover?: string | null;
    gallery?: string[];
    continue_button_text?: string;
}

export const EVENT_PREVIEW_MESSAGE = "UPDATE_EVENT_PREVIEW";
export const EVENT_PREVIEW_READY = "EVENT_PREVIEW_READY";
