import {useEffect, useMemo, useState} from "react";
import {useBlocker, useParams, useSearchParams} from "react-router";
import {useHoldPageRefresh} from "../../../layouts/AppLayout/pageRefresh.ts";
import {plural, t} from "@lingui/macro";
import {Button, Skeleton, Text} from "@mantine/core";
import {useMediaQuery} from "@mantine/hooks";
import {modals} from "@mantine/modals";
import {useGetOrganizer} from "../../../../queries/useGetOrganizer.ts";
import {useGetOrganizerSettings} from "../../../../queries/useGetOrganizerSettings.ts";
import {useUpdateOrganizer} from "../../../../mutations/useUpdateOrganizer.ts";
import {useUpdateOrganizerSettings} from "../../../../mutations/useUpdateOrganizerSettings.ts";
import {useUploadImage} from "../../../../mutations/useUploadImage.ts";
import {useDeleteImage} from "../../../../mutations/useDeleteImage.ts";
import {HomepageThemeSettings, OrganizerSettings} from "../../../../types.ts";
import {organizerHomepageUrl, organizerPreviewPath} from "../../../../utilites/urlHelper.ts";
import {showError, showSuccess} from "../../../../utilites/notifications.tsx";
import {queryClient} from "../../../../utilites/queryClient.ts";
import {GET_ORGANIZER_PUBLIC_QUERY_KEY} from "../../../../queries/useGetOrganizerPublic.ts";
import {OrganizerPreviewDraft} from "../../../layouts/OrganizerHomepagePreview/previewMessages.ts";
import {
    cleanDescription,
    DraftImage,
    draftChanges,
    draftSocialHandles,
    draftSocialLayout,
    HomepageDraft,
    publishedDraft,
} from "./homepageDraft.ts";
import {DesignerSection, SectionId} from "./DesignerSection.tsx";
import {ImagesSection} from "./ImagesSection.tsx";
import {AccentSection} from "./AccentSection.tsx";
import {InfoSection} from "./InfoSection.tsx";
import {SocialLinksSection} from "./SocialLinksSection.tsx";
import {FaqSection} from "./FaqSection.tsx";
import {PreviewModal, PreviewPanel} from "./PreviewPanel.tsx";
import classes from "./OrganizerHomepageDesigner.module.scss";

const IMAGE_TYPES = {cover: 'ORGANIZER_COVER', logo: 'ORGANIZER_LOGO'} as const;

const revokeNewImages = (draft: HomepageDraft | null) => [draft?.cover, draft?.logo]
    .forEach(image => image?.kind === 'new' && URL.revokeObjectURL(image.url));

const errorMessage = (error: any): string | null => {
    const errors = error?.response?.data?.errors;
    const first = errors && Object.values(errors).flat()[0];
    return (typeof first === 'string' ? first : null) ?? error?.response?.data?.message ?? null;
};

// « Ma page » (formerly the homepage designer): the organizer's public page, edited as a draft
// with a live preview, then published at once.
const OrganizerHomepageDesigner = () => {
    const {organizerId} = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const organizerQuery = useGetOrganizer(organizerId);
    const settingsQuery = useGetOrganizerSettings(organizerId);
    const organizer = organizerQuery.data;
    const settings = settingsQuery.data;

    const updateOrganizer = useUpdateOrganizer();
    const updateSettings = useUpdateOrganizerSettings();
    const uploadImage = useUploadImage();
    const deleteImage = useDeleteImage();

    const published = useMemo(
        () => organizer && settings ? publishedDraft(organizer, settings) : null,
        [organizer, settings],
    );
    const [draft, setDraft] = useState<HomepageDraft | null>(null);
    // Remounts the editors (description, open rows) when the draft is replaced.
    const [resetKey, setResetKey] = useState(0);
    const [openSections, setOpenSections] = useState<SectionId[]>(
        () => searchParams.get('section') === 'faq' ? ['faq'] : []
    );
    const [editingFaq, setEditingFaq] = useState<string | null>(null);
    const [faqErrors, setFaqErrors] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const isWide = useMediaQuery('(min-width: 75em)', false, {getInitialValueInEffect: true});

    useEffect(() => {
        if (published && !draft) {
            setDraft(published);
        }
    }, [published]);

    // The old FAQ page leads here with ?section=faq.
    useEffect(() => {
        if (draft && searchParams.has('section')) {
            document.getElementById(`ma-page-${searchParams.get('section')}`)?.scrollIntoView({block: 'start'});
            searchParams.delete('section');
            setSearchParams(searchParams, {replace: true});
        }
    }, [!!draft]);

    const changes = useMemo(() => published && draft ? draftChanges(published, draft) : null, [published, draft]);
    const changeCount = changes?.count ?? 0;

    // The assistant's changes don't restart the page over unpublished work.
    useHoldPageRefresh(changeCount > 0);

    const blocker = useBlocker(({currentLocation, nextLocation}) =>
        changeCount > 0 && !publishing && currentLocation.pathname !== nextLocation.pathname);

    useEffect(() => {
        if (blocker.state !== 'blocked') {
            return;
        }
        let leaving = false;
        modals.openConfirmModal({
            title: t`Leave without publishing?`,
            children: <Text size="sm">{t`Your unpublished changes will be lost.`}</Text>,
            labels: {confirm: t`Leave`, cancel: t`Stay`},
            onConfirm: () => {
                leaving = true;
                blocker.proceed?.();
            },
            onClose: () => !leaving && blocker.reset?.(),
        });
    }, [blocker.state]);

    useEffect(() => {
        if (changeCount === 0) {
            return;
        }
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [changeCount > 0]);

    const previewDraft = useMemo<OrganizerPreviewDraft>(() => draft && settings ? {
        organizer: {name: draft.name, description: cleanDescription(draft.description)},
        images: {ORGANIZER_COVER: draft.cover?.url ?? null, ORGANIZER_LOGO: draft.logo?.url ?? null},
        settings: {
            homepage_theme_settings: {...settings.homepage_theme_settings, accent: draft.accent},
            social_media_handles: draftSocialHandles(draft.socialLinks),
            social_media_layout: draftSocialLayout(draft.socialLinks),
            faqs: draft.faqs
                .filter(faq => faq.question.trim() && faq.answer.trim())
                .map(({question, answer}) => ({question, answer})),
        },
    } : {}, [draft, settings]);

    const edit = (values: Partial<HomepageDraft>) => setDraft(current => current && {...current, ...values});

    const setImage = (key: 'cover' | 'logo', image: DraftImage) => setDraft(current => {
        const previous = current?.[key];
        if (previous?.kind === 'new' && previous.url !== image?.url) {
            URL.revokeObjectURL(previous.url);
        }
        return current && {...current, [key]: image};
    });

    const toggleSection = (id: SectionId) => setOpenSections(current =>
        current.includes(id) ? current.filter(section => section !== id) : [...current, id]);

    const openSection = (id: SectionId) => {
        setOpenSections(current => current.includes(id) ? current : [...current, id]);
        setTimeout(() => document.getElementById(`ma-page-${id}`)?.scrollIntoView({behavior: 'smooth', block: 'start'}), 220);
    };

    const replaceDraft = (next: HomepageDraft | null) => {
        revokeNewImages(draft);
        setDraft(next);
        setResetKey(key => key + 1);
        setEditingFaq(null);
        setFaqErrors(false);
    };

    const discard = () => published && replaceDraft(published);

    const publish = async () => {
        if (!draft || !published || !changes || !organizer || !settings || !organizerId) {
            return;
        }

        const faqs = draft.faqs.filter(faq => faq.question.trim() || faq.answer.trim());
        const unfinished = faqs.find(faq => !faq.question.trim() || !faq.answer.trim());
        if (unfinished) {
            setFaqErrors(true);
            setEditingFaq(unfinished.key);
            openSection('faq');
            showError(t`Complete or delete the unfinished questions before publishing.`);
            return;
        }
        if (!draft.name.trim()) {
            openSection('info');
            showError(t`Name is required`);
            return;
        }

        setPublishing(true);
        try {
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
                    setImage(key, {kind: 'saved', id: data.id, url: data.url});
                } else if (!image && previous?.kind === 'saved') {
                    await deleteImage.mutateAsync({imageId: previous.id});
                }
            }

            if (changes.organizer) {
                await updateOrganizer.mutateAsync({
                    organizerId,
                    organizerData: {
                        name: draft.name.trim(),
                        description: cleanDescription(draft.description),
                        email: organizer.email,
                        phone: organizer.phone,
                        website: organizer.website,
                        donation_url: organizer.donation_url,
                        currency: organizer.currency,
                        timezone: organizer.timezone,
                    },
                });
            }

            if (changes.accent || changes.socialLinks || changes.faqs) {
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

            const [freshOrganizer, freshSettings] = await Promise.all([organizerQuery.refetch(), settingsQuery.refetch()]);
            if (freshOrganizer.data && freshSettings.data) {
                replaceDraft(publishedDraft(freshOrganizer.data, freshSettings.data));
            }
            showSuccess(t`Your page is published`);
        } catch (error) {
            showError(errorMessage(error) ?? t`Some changes could not be published. Please try again.`);
            await Promise.all([organizerQuery.refetch(), settingsQuery.refetch()]);
        } finally {
            setPublishing(false);
            queryClient.invalidateQueries({queryKey: [GET_ORGANIZER_PUBLIC_QUERY_KEY, organizerId]});
        }
    };

    const publicPath = `/events/${organizerId}/${organizer?.slug || ''}`;
    const displayUrl = organizer ? organizerHomepageUrl(organizer).replace(/^https?:\/\//, '') : '';
    const previewSrc = organizerPreviewPath(organizerId);
    const loading = !draft;
    const faqCount = draft?.faqs.length ?? 0;

    const sections: { id: SectionId, icon: string, title: string, long: string, short: string }[] = [
        {id: 'images', icon: 'image', title: t`Images`, long: t`Logo and cover image`, short: t`Logo and cover`},
        {
            id: 'accent',
            icon: 'drop',
            title: t`Accent color`,
            long: t`Buttons and highlighted elements`,
            short: t`Buttons and highlighted elements`
        },
        {
            id: 'info',
            icon: 'user',
            title: t`Info and description`,
            long: t`Name and introduction text`,
            short: t`Name and introduction`
        },
        {
            id: 'social',
            icon: 'link',
            title: t`Social networks`,
            long: t`Which ones to show and in what order`,
            short: t`Display and order`
        },
        {
            id: 'faq',
            icon: 'help',
            title: t`FAQ`,
            long: plural(faqCount, {
                0: 'No questions yet',
                one: '# question · shown at the bottom of the page',
                other: '# questions · shown at the bottom of the page',
            }),
            short: t`Shown at the bottom of the page`,
        },
    ];

    const sectionContent = (id: SectionId) => {
        if (!draft) {
            return null;
        }
        switch (id) {
            case 'images':
                return <ImagesSection cover={draft.cover} logo={draft.logo} onChange={setImage} disabled={publishing}/>;
            case 'accent':
                return <AccentSection accent={draft.accent} onChange={(accent) => edit({accent})} disabled={publishing}/>;
            case 'info':
                return (
                    <InfoSection
                        name={draft.name}
                        description={draft.description}
                        editorKey={resetKey}
                        onChange={edit}
                        disabled={publishing}
                    />
                );
            case 'social':
                return (
                    <SocialLinksSection
                        key={resetKey}
                        links={draft.socialLinks}
                        onChange={(socialLinks) => edit({socialLinks})}
                        disabled={publishing}
                    />
                );
            case 'faq':
                return (
                    <FaqSection
                        faqs={draft.faqs}
                        onChange={(faqs) => edit({faqs})}
                        editing={editingFaq}
                        onEdit={setEditingFaq}
                        showErrors={faqErrors}
                        disabled={publishing}
                    />
                );
        }
    };

    return (
        <div className={classes.page}>
            <header className={classes.header}>
                <div className={classes.heading}>
                    <h1 className={classes.title}>{t`My page`}</h1>
                    <p className={classes.subtitle}>
                        {t`Customize your public page.`}
                        <span className={classes.wideOnly}> {t`Changes appear on the right.`}</span>
                    </p>
                </div>
                <div className={classes.headerActions}>
                    <Button
                        component="a"
                        href={publicPath}
                        target="_blank"
                        rel="noopener"
                        className={`${classes.button} ${classes.buttonOutline} ${classes.wideOnly}`}
                        leftSection={<img src="/interface/admin/ma-page/eye.svg" alt=""/>}
                    >
                        {t`View my page`}
                    </Button>
                    <Button
                        className={`${classes.button} ${classes.buttonOutline} ${classes.narrowOnly}`}
                        leftSection={<img src="/interface/admin/ma-page/eye.svg" alt=""/>}
                        onClick={() => setPreviewOpen(true)}
                        disabled={loading}
                    >
                        {t`Preview`}
                    </Button>
                    <Button
                        className={`${classes.button} ${classes.buttonFilled}`}
                        leftSection={<img src="/interface/admin/ma-page/globe.svg" alt=""/>}
                        onClick={publish}
                        loading={publishing}
                        disabled={changeCount === 0}
                    >
                        <span className={classes.longLabel}>{t`Publish changes`}</span>
                        <span className={classes.shortLabel}>{t`Publish`}</span>
                    </Button>
                </div>
            </header>

            <div className={classes.designer}>
                <div className={classes.settings}>
                    {loading ? (
                        <Skeleton height={46} radius={20}/>
                    ) : (
                        <div className={classes.status} data-published={changeCount === 0 || undefined} role="status">
                            <span className={classes.statusDot}/>
                            <span className={classes.statusText}>
                                {changeCount > 0
                                    ? plural(changeCount, {
                                        one: '# change not yet published',
                                        other: '# changes not yet published',
                                    })
                                    : t`Everything is published`}
                            </span>
                            {changeCount > 0 && (
                                <button type="button" className={`${classes.textButton} ${classes.discard}`}
                                        onClick={discard} disabled={publishing}>
                                    {t`Cancel`}
                                </button>
                            )}
                        </div>
                    )}

                    {sections.map(section => loading ? (
                        <Skeleton key={section.id} height={81} radius={24}/>
                    ) : (
                        <DesignerSection
                            key={section.id}
                            id={section.id}
                            icon={section.icon}
                            title={section.title}
                            subtitle={(
                                <>
                                    <span className={classes.longLabel}>{section.long}</span>
                                    <span className={classes.shortLabel}>{section.short}</span>
                                </>
                            )}
                            open={openSections.includes(section.id)}
                            onToggle={toggleSection}
                        >
                            {sectionContent(section.id)}
                        </DesignerSection>
                    ))}
                </div>

                {isWide && (
                    <div className={classes.previewColumn}>
                        {loading
                            ? <Skeleton height={600} radius={28}/>
                            : <PreviewPanel src={previewSrc} url={displayUrl} draft={previewDraft}/>}
                    </div>
                )}
            </div>

            {!isWide && !loading && (
                <PreviewModal
                    opened={previewOpen}
                    onClose={() => setPreviewOpen(false)}
                    src={previewSrc}
                    draft={previewDraft}
                />
            )}
        </div>
    );
};

export default OrganizerHomepageDesigner;
