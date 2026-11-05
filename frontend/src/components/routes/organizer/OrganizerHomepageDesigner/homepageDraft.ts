import {IdParam, Organizer, OrganizerSettings, SocialMediaLayoutEntry} from "../../../../types.ts";
import {visibleSocialHandles} from "../../../../utilites/socialLinks.ts";
import {OrganizerPageSuggestion} from "../../../../api/organizer.client.ts";

// « Ma page » edits a local draft; nothing reaches the public page before « Publier les changements ».

export type DraftImage =
    | { kind: 'saved', id: IdParam, url: string }
    | { kind: 'new', file: File, url: string }
    | null;

export interface DraftSocialLink {
    platform: string;
    handle: string;
    visible: boolean;
}

export interface DraftFaq {
    // Stable id for drag and drop and for matching the published question.
    key: string;
    question: string;
    answer: string;
}

export interface HomepageDraft {
    cover: DraftImage;
    logo: DraftImage;
    accent: string;
    name: string;
    description: string;
    socialLinks: DraftSocialLink[];
    faqs: DraftFaq[];
}

// The public page keeps the Dehors orange while no accent is saved.
export const DEFAULT_ACCENT = '#FA7853';

let newKey = 0;
export const newFaqKey = () => `new-${++newKey}`;

const savedImage = (organizer: Organizer, type: 'ORGANIZER_COVER' | 'ORGANIZER_LOGO'): DraftImage => {
    const image = organizer.images?.find(img => img.type === type);
    return image?.id ? {kind: 'saved', id: image.id, url: image.url} : null;
};

export const publishedDraft = (organizer: Organizer, settings: OrganizerSettings): HomepageDraft => {
    const handles = settings.social_media_handles ?? {};
    const shown = new Set(visibleSocialHandles(handles, settings.social_media_layout).map(({platform}) => platform));
    const order = [
        ...(settings.social_media_layout ?? []).map(({platform}) => platform),
        ...Object.keys(handles),
    ];

    return {
        cover: savedImage(organizer, 'ORGANIZER_COVER'),
        logo: savedImage(organizer, 'ORGANIZER_LOGO'),
        accent: settings.homepage_theme_settings?.accent || DEFAULT_ACCENT,
        name: organizer.name ?? '',
        description: organizer.description ?? '',
        socialLinks: [...new Set(order)]
            .filter(platform => (handles as Record<string, string | undefined>)[platform]?.trim())
            .map(platform => ({
                platform,
                handle: (handles as Record<string, string>)[platform],
                visible: shown.has(platform),
            })),
        faqs: (settings.faqs ?? []).map((faq, index) => ({key: `faq-${index}`, ...faq})),
    };
};

const sameColor = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The editor writes an empty description as an empty paragraph.
export const cleanDescription = (html: string) => {
    const text = html.replace(/<p[^>]*>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '').trim();
    return text === '' ? '' : html;
};

// A network without a handle doesn't exist yet: it isn't published.
const filledLinks = (links: DraftSocialLink[]) => links
    .map(link => ({...link, handle: link.handle.trim()}))
    .filter(link => link.handle !== '');

const orderChanged = (before: string[], after: string[]) => {
    const common = new Set(before.filter(key => after.includes(key)));
    const a = before.filter(key => common.has(key));
    const b = after.filter(key => common.has(key));
    return a.some((key, index) => key !== b[index]);
};

const countSocialChanges = (published: DraftSocialLink[], draft: DraftSocialLink[]) => {
    const before = filledLinks(published);
    const after = filledLinks(draft);
    const platforms = new Set([...before, ...after].map(link => link.platform));
    let count = 0;
    platforms.forEach(platform => {
        const a = before.find(link => link.platform === platform);
        const b = after.find(link => link.platform === platform);
        if (!a || !b || a.handle !== b.handle || a.visible !== b.visible) {
            count++;
        }
    });
    return count + (orderChanged(before.map(link => link.platform), after.map(link => link.platform)) ? 1 : 0);
};

const countFaqChanges = (published: DraftFaq[], draft: DraftFaq[]) => {
    const keys = new Set([...published, ...draft].map(faq => faq.key));
    let count = 0;
    keys.forEach(key => {
        const a = published.find(faq => faq.key === key);
        const b = draft.find(faq => faq.key === key);
        if (!a || !b || a.question.trim() !== b.question.trim() || a.answer.trim() !== b.answer.trim()) {
            count++;
        }
    });
    return count + (orderChanged(published.map(faq => faq.key), draft.map(faq => faq.key)) ? 1 : 0);
};

export interface DraftChanges {
    cover: boolean;
    logo: boolean;
    organizer: boolean;
    accent: boolean;
    socialLinks: boolean;
    faqs: boolean;
    count: number;
}

export const draftChanges = (published: HomepageDraft, draft: HomepageDraft): DraftChanges => {
    const cover = published.cover?.url !== draft.cover?.url;
    const logo = published.logo?.url !== draft.logo?.url;
    const name = published.name.trim() !== draft.name.trim();
    const description = cleanDescription(published.description) !== cleanDescription(draft.description);
    const accent = !sameColor(published.accent, draft.accent);
    const socialCount = countSocialChanges(published.socialLinks, draft.socialLinks);
    const faqCount = countFaqChanges(published.faqs, draft.faqs);

    return {
        cover,
        logo,
        organizer: name || description,
        accent,
        socialLinks: socialCount > 0,
        faqs: faqCount > 0,
        count: [cover, logo, name, description, accent].filter(Boolean).length + socialCount + faqCount,
    };
};

export const draftSocialLayout = (links: DraftSocialLink[]): SocialMediaLayoutEntry[] =>
    filledLinks(links).map(({platform, visible}) => ({platform, visible}));

export const draftSocialHandles = (links: DraftSocialLink[]): Record<string, string> =>
    Object.fromEntries(filledLinks(links).map(({platform, handle}) => [platform, handle]));

export type ImportPart = 'name' | 'description' | 'accent' | 'logo' | 'cover' | 'social' | 'faqs';

// The server sends images as data: URLs; they become files, like the ones an organizer drops.
export const suggestionImage = async (dataUrl: string, name: string): Promise<Extract<DraftImage, { kind: 'new' }>> => {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], `${name}.${blob.type.split('/')[1] ?? 'png'}`, {type: blob.type});
    return {kind: 'new', file, url: URL.createObjectURL(file)};
};

// What the organizer keeps from a suggestion, images aside.
export const mergeSuggestion = (
    draft: HomepageDraft,
    suggestion: OrganizerPageSuggestion,
    parts: ImportPart[],
): HomepageDraft => {
    const next = {...draft};
    if (parts.includes('name') && suggestion.name) {
        next.name = suggestion.name;
    }
    if (parts.includes('description') && suggestion.description) {
        next.description = suggestion.description;
    }
    if (parts.includes('accent') && suggestion.accent) {
        next.accent = suggestion.accent;
    }
    if (parts.includes('social')) {
        // Accounts already filled in stay; the others are added, visible.
        const links = draft.socialLinks.map(link => {
            const found = suggestion.social_links.find(s => s.platform === link.platform);
            return !link.handle.trim() && found ? {...link, handle: found.handle, visible: true} : link;
        });
        suggestion.social_links
            .filter(found => !links.some(link => link.platform === found.platform))
            .forEach(found => links.push({platform: found.platform, handle: found.handle, visible: true}));
        next.socialLinks = links;
    }
    if (parts.includes('faqs')) {
        const asked = new Set(draft.faqs.map(faq => faq.question.trim().toLowerCase()));
        next.faqs = [
            ...draft.faqs,
            ...suggestion.faqs
                .filter(faq => !asked.has(faq.question.trim().toLowerCase()))
                .map(faq => ({key: newFaqKey(), question: faq.question, answer: faq.answer})),
        ];
    }
    return next;
};
