import {IdParam, Organizer, OrganizerSettings, SocialMediaLayoutEntry} from "../../../../types.ts";
import {visibleSocialHandles} from "../../../../utilites/socialLinks.ts";

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
