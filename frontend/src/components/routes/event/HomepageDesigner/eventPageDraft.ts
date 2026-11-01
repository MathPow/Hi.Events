import {Event, EventSettings, Image} from "../../../../types.ts";
import {cleanDescription, DEFAULT_ACCENT, DraftImage} from "../../organizer/OrganizerHomepageDesigner/homepageDraft.ts";

// The homepage designer edits a local draft of the event's page; nothing reaches the public page
// before « Publier les changements ».
export interface EventPageDraft {
    cover: DraftImage;
    accent: string;
    title: string;
    description: string;
    buttonText: string;
}

export const publishedEventDraft = (event: Event, settings: EventSettings, images: Image[] = []): EventPageDraft => {
    const cover = images.find(image => image.type === 'EVENT_COVER');
    return {
        cover: cover?.id ? {kind: 'saved', id: cover.id, url: cover.url} : null,
        accent: settings.homepage_theme_settings?.accent || DEFAULT_ACCENT,
        title: event.title ?? '',
        description: event.description ?? '',
        buttonText: settings.continue_button_text ?? '',
    };
};

const sameColor = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export interface EventPageChanges {
    cover: boolean;
    accent: boolean;
    event: boolean;
    buttonText: boolean;
    count: number;
}

export const eventDraftChanges = (published: EventPageDraft, draft: EventPageDraft): EventPageChanges => {
    const cover = published.cover?.url !== draft.cover?.url;
    const accent = !sameColor(published.accent, draft.accent);
    const title = published.title.trim() !== draft.title.trim();
    const description = cleanDescription(published.description) !== cleanDescription(draft.description);
    const buttonText = published.buttonText.trim() !== draft.buttonText.trim();

    return {
        cover,
        accent,
        event: title || description,
        buttonText,
        count: [cover, accent, title, description, buttonText].filter(Boolean).length,
    };
};
