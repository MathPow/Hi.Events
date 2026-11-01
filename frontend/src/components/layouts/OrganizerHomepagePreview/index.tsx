import {useEffect, useState} from "react";
import {useLoaderData, useParams} from "react-router";
import {useGetOrganizerSettings} from "../../../queries/useGetOrganizerSettings.ts";
import {LoadingMask} from "../../common/LoadingMask";
import OrganizerHomepage from "../OrganizerHomepage";
import {Image, ImageType, Organizer} from "../../../types.ts";
import {ORGANIZER_PREVIEW_MESSAGE, ORGANIZER_PREVIEW_READY, OrganizerPreviewDraft} from "./previewMessages.ts";

const previewImages = (images: Image[] = [], draft?: OrganizerPreviewDraft['images']): Image[] => {
    if (!draft) {
        return images;
    }
    const types = Object.keys(draft) as ImageType[];
    const kept = images
        .filter(image => !types.includes(image.type) || draft[image.type as keyof typeof draft])
        .map(image => {
            const url = draft[image.type as keyof typeof draft];
            return url && url !== image.url ? {...image, url, lqip_base64: undefined} : image;
        });
    const added = types
        .filter(type => draft[type as keyof typeof draft] && !images.some(image => image.type === type))
        .map(type => ({type, url: draft[type as keyof typeof draft] as string} as Image));

    return [...kept, ...added];
};

const OrganizerHomepagePreview = () => {
    const {organizerId} = useParams();

    const {organizer, eventsData} = useLoaderData() as {
        organizer: Organizer | null;
        eventsData: any;
        isPastEvents: boolean;
    };

    const organizerSettingsQuery = useGetOrganizerSettings(organizerId);
    const [draft, setDraft] = useState<OrganizerPreviewDraft | null>(null);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin === window.location.origin && event.data?.type === ORGANIZER_PREVIEW_MESSAGE) {
                setDraft(event.data.draft ?? null);
            }
        };

        window.addEventListener("message", handleMessage);
        // The designer sends the draft again: the iframe's load event may have come before this listener.
        if (window.parent !== window) {
            window.parent.postMessage({type: ORGANIZER_PREVIEW_READY}, window.location.origin);
        }
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    if (!organizer || organizerSettingsQuery.isLoading) {
        return <LoadingMask/>;
    }

    if (!organizer || !organizerSettingsQuery.data) {
        return null;
    }

    const previewOrganizer: Organizer = {
        ...organizer,
        ...draft?.organizer,
        images: previewImages(organizer.images, draft?.images),
        settings: {
            ...organizerSettingsQuery.data,
            ...draft?.settings,
        },
    };

    return <OrganizerHomepage
        organizer={previewOrganizer}
        eventsData={eventsData}
        isPastEvents={false}
    />;
};

export default OrganizerHomepagePreview;
