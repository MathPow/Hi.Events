import {Event, EventSettings, Image} from "../../../../types.ts";
import {eventGalleryImages} from "../../../../utilites/urlHelper.ts";
import {cleanDescription, DEFAULT_ACCENT, DraftImage} from "../../organizer/OrganizerHomepageDesigner/homepageDraft.ts";

// The homepage designer edits a local draft of the event's page; nothing reaches the public page
// before « Publier les changements ».
export type GalleryDraftImage = NonNullable<DraftImage>;

export interface EventPageDraft {
    cover: DraftImage;
    gallery: GalleryDraftImage[];
    accent: string;
    title: string;
    description: string;
    buttonText: string;
}

export const publishedEventDraft = (event: Event, settings: EventSettings, images: Image[] = []): EventPageDraft => {
    const cover = images.find(image => image.type === 'EVENT_COVER');
    return {
        cover: cover?.id ? {kind: 'saved', id: cover.id, url: cover.url} : null,
        gallery: eventGalleryImages({images} as Event)
            .map((image): GalleryDraftImage => ({kind: 'saved', id: image.id, url: image.url})),
        accent: settings.homepage_theme_settings?.accent || DEFAULT_ACCENT,
        title: event.title ?? '',
        description: event.description ?? '',
        buttonText: settings.continue_button_text ?? '',
    };
};

const sameColor = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export interface EventPageChanges {
    cover: boolean;
    gallery: boolean;
    accent: boolean;
    event: boolean;
    buttonText: boolean;
    count: number;
}

export const eventDraftChanges = (published: EventPageDraft, draft: EventPageDraft): EventPageChanges => {
    const cover = published.cover?.url !== draft.cover?.url;
    const gallery = published.gallery.map(image => image.url).join('\n') !== draft.gallery.map(image => image.url).join('\n');
    const accent = !sameColor(published.accent, draft.accent);
    const title = published.title.trim() !== draft.title.trim();
    const description = cleanDescription(published.description) !== cleanDescription(draft.description);
    const buttonText = published.buttonText.trim() !== draft.buttonText.trim();

    return {
        cover,
        gallery,
        accent,
        event: title || description,
        buttonText,
        count: [cover, gallery, accent, title, description, buttonText].filter(Boolean).length,
    };
};
