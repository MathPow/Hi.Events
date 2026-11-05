import {useUpdateOrganizer} from "../../../../mutations/useUpdateOrganizer.ts";
import {useUpdateOrganizerSettings} from "../../../../mutations/useUpdateOrganizerSettings.ts";
import {useUploadImage} from "../../../../mutations/useUploadImage.ts";
import {useDeleteImage} from "../../../../mutations/useDeleteImage.ts";
import {HomepageThemeSettings, IdParam, Organizer, OrganizerSettings} from "../../../../types.ts";
import {
    cleanDescription,
    DraftImage,
    draftChanges,
    draftSocialHandles,
    draftSocialLayout,
    HomepageDraft,
} from "./homepageDraft.ts";

const IMAGE_TYPES = {cover: 'ORGANIZER_COVER', logo: 'ORGANIZER_LOGO'} as const;

interface SaveHomepageDraft {
    organizerId: IdParam;
    organizer: Organizer;
    settings: OrganizerSettings;
    published: HomepageDraft;
    draft: HomepageDraft;
    // Not part of the draft: the address of the site the page was filled from.
    website?: string;
    onImageSaved?: (key: 'cover' | 'logo', image: DraftImage) => void;
}

// What differs between the draft and the published page, written to the server.
export const useSaveHomepageDraft = () => {
    const updateOrganizer = useUpdateOrganizer();
    const updateSettings = useUpdateOrganizerSettings();
    const uploadImage = useUploadImage();
    const deleteImage = useDeleteImage();

    return async ({organizerId, organizer, settings, published, draft, website, onImageSaved}: SaveHomepageDraft) => {
        const changes = draftChanges(published, draft);

        for (const key of ['cover', 'logo'] as const) {
            const image = draft[key];
            const previous = published[key];
            if (!changes[key]) {
                continue;
            }
            if (image?.kind === 'new') {
                // Replaces the previous image (one cover and one logo per organizer).
                const {data} = await uploadImage.mutateAsync({
                    image: image.file,
                    imageType: IMAGE_TYPES[key],
                    entityId: organizerId,
                });
                onImageSaved?.(key, {kind: 'saved', id: data.id, url: data.url});
            } else if (!image && previous?.kind === 'saved') {
                await deleteImage.mutateAsync({imageId: previous.id});
            }
        }

        if (changes.organizer || website) {
            await updateOrganizer.mutateAsync({
                organizerId,
                organizerData: {
                    name: draft.name.trim(),
                    description: cleanDescription(draft.description),
                    email: organizer.email,
                    phone: organizer.phone,
                    website: website ?? organizer.website,
                    donation_url: organizer.donation_url,
                    currency: organizer.currency,
                    timezone: organizer.timezone,
                },
            });
        }

        if (changes.accent || changes.socialLinks || changes.faqs) {
            const faqs = draft.faqs.filter(faq => faq.question.trim() || faq.answer.trim());
            const handles = draftSocialHandles(draft.socialLinks);
            const platforms = new Set([...published.socialLinks, ...draft.socialLinks].map(link => link.platform));
            await updateSettings.mutateAsync({
                organizerId,
                organizerSettings: {
                    ...(changes.accent && {
                        homepage_theme_settings: {
                            ...settings.homepage_theme_settings,
                            accent: draft.accent,
                        } as HomepageThemeSettings,
                    }),
                    ...(changes.socialLinks && {
                        ...Object.fromEntries([...platforms].map(platform => [`${platform}_handle`, handles[platform] ?? null])),
                        social_media_layout: draftSocialLayout(draft.socialLinks),
                    }),
                    ...(changes.faqs && {
                        faqs: faqs.map(({question, answer}) => ({question: question.trim(), answer: answer.trim()})),
                    }),
                } as Partial<OrganizerSettings>,
            });
        }
    };
};
