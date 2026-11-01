import {Organizer, OrganizerSettings} from "../../../types.ts";

// The draft of « Ma page », sent by the designer (OrganizerHomepageDesigner) to this iframe.
// images: the url of each image as it will be published, null when it is removed.
export interface OrganizerPreviewDraft {
    organizer?: Partial<Pick<Organizer, 'name' | 'description'>>;
    settings?: Partial<OrganizerSettings>;
    images?: Partial<Record<'ORGANIZER_COVER' | 'ORGANIZER_LOGO', string | null>>;
}

export const ORGANIZER_PREVIEW_MESSAGE = "UPDATE_ORGANIZER_SETTINGS";
export const ORGANIZER_PREVIEW_READY = "ORGANIZER_PREVIEW_READY";
