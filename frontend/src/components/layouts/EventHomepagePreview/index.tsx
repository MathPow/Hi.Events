import {useEffect, useState} from "react";
import {useParams} from "react-router";
import {LoadingOverlay} from "@mantine/core";
import {Event, HomepageThemeSettings, Image} from "../../../types.ts";
import {useGetEventPublic} from "../../../queries/useGetEventPublic.ts";
import {EventNotAvailable} from "../EventHomepage/EventNotAvailable";
import EventHomepage from "../EventHomepage";
import {EVENT_PREVIEW_MESSAGE, EVENT_PREVIEW_READY, EventPreviewDraft} from "./previewMessages.ts";

// The cover as it will be published: replaced, removed or added.
const previewImages = (images: Image[] = [], cover: EventPreviewDraft['cover']): Image[] => {
    if (cover === undefined) {
        return images;
    }
    const others = images.filter(image => image.type !== 'EVENT_COVER');
    if (cover === null) {
        return others;
    }
    const current = images.find(image => image.type === 'EVENT_COVER');
    return [...others, current?.url === cover ? current : {...current, type: 'EVENT_COVER', url: cover, lqip_base64: undefined} as Image];
};

// The photos as they will be published; the new ones come after the saved ones, as on the page.
const previewGallery = (images: Image[], gallery: EventPreviewDraft['gallery']): Image[] => {
    if (gallery === undefined) {
        return images;
    }
    const others = images.filter(image => image.type !== 'EVENT_GALLERY');
    const saved = images.filter(image => image.type === 'EVENT_GALLERY');
    return [...others, ...gallery.map((url, index) => saved.find(image => image.url === url)
        ?? {id: Number.MAX_SAFE_INTEGER - gallery.length + index, type: 'EVENT_GALLERY', url} as Image)];
};

// The event's page inside the homepage designer, showing the draft it sends.
const EventHomepagePreview = () => {
    const {eventId} = useParams();
    const {data: event, isFetched, isLoading} = useGetEventPublic(eventId);
    const [draft, setDraft] = useState<EventPreviewDraft | null>(null);

    useEffect(() => {
        const handleMessage = (messageEvent: MessageEvent) => {
            if (messageEvent.origin === window.location.origin && messageEvent.data?.type === EVENT_PREVIEW_MESSAGE) {
                setDraft(messageEvent.data.draft ?? null);
            }
        };

        window.addEventListener("message", handleMessage);
        // The designer sends the draft again: the iframe's load event may have come before this listener.
        if (window.parent !== window) {
            window.parent.postMessage({type: EVENT_PREVIEW_READY}, window.location.origin);
        }
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    if (!isFetched || isLoading) {
        return <LoadingOverlay visible/>;
    }

    if (!event) {
        return <EventNotAvailable/>;
    }

    const previewEvent: Event = draft ? {
        ...event,
        ...draft.event,
        images: previewGallery(previewImages(event.images, draft.cover), draft.gallery),
        settings: event.settings && {
            ...event.settings,
            homepage_theme_settings: {
                ...event.settings.homepage_theme_settings,
                ...(draft.accent && {accent: draft.accent}),
            } as HomepageThemeSettings,
            continue_button_text: draft.continue_button_text ?? event.settings.continue_button_text,
        },
    } : event;

    return (
        <EventHomepage
            event={previewEvent}
            promoCodeValid={undefined}
            promoCode={undefined}
        />
    );
};

export default EventHomepagePreview;
