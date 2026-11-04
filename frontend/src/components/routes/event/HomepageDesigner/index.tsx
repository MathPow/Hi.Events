import {useEffect, useMemo, useState} from "react";
import {useBlocker, useParams} from "react-router";
import {useHoldPageRefresh} from "../../../layouts/AppLayout/pageRefresh.ts";
import {plural, t} from "@lingui/macro";
import {Button, Text, TextInput} from "@mantine/core";
import {useMediaQuery} from "@mantine/hooks";
import {modals} from "@mantine/modals";
import {useGetEvent} from "../../../../queries/useGetEvent.ts";
import {useGetEventSettings} from "../../../../queries/useGetEventSettings.ts";
import {useGetEventImages} from "../../../../queries/useGetEventImages.ts";
import {GET_EVENT_PUBLIC_QUERY_KEY} from "../../../../queries/useGetEventPublic.ts";
import {useUpdateEvent} from "../../../../mutations/useUpdateEvent.ts";
import {useUpdateEventSettings} from "../../../../mutations/useUpdateEventSettings.ts";
import {useUploadImage} from "../../../../mutations/useUploadImage.ts";
import {useDeleteImage} from "../../../../mutations/useDeleteImage.ts";
import {Event, HomepageThemeSettings} from "../../../../types.ts";
import {eventHomepagePath, eventHomepageUrl, eventPreviewPath} from "../../../../utilites/urlHelper.ts";
import {utcToTz} from "../../../../utilites/dates.ts";
import {showError, showSuccess} from "../../../../utilites/notifications.tsx";
import {queryClient} from "../../../../utilites/queryClient.ts";
import {Editor} from "../../../common/Editor";
import {
    EVENT_PREVIEW_MESSAGE,
    EVENT_PREVIEW_READY,
    EventPreviewDraft,
} from "../../../layouts/EventHomepagePreview/previewMessages.ts";
import {cleanDescription, DraftImage} from "../../organizer/OrganizerHomepageDesigner/homepageDraft.ts";
import {DesignerSection, SectionId} from "../../organizer/OrganizerHomepageDesigner/DesignerSection.tsx";
import {ImagePicker} from "../../organizer/OrganizerHomepageDesigner/ImagesSection.tsx";
import {AccentSection} from "../../organizer/OrganizerHomepageDesigner/AccentSection.tsx";
import {PreviewMessages, PreviewModal, PreviewPanel, PreviewSkeleton} from "../../organizer/OrganizerHomepageDesigner/PreviewPanel.tsx";
import {eventDraftChanges, EventPageDraft, publishedEventDraft} from "./eventPageDraft.ts";
import {SkeletonLine} from "../../../common/Skeletons";
import classes from "../../organizer/OrganizerHomepageDesigner/OrganizerHomepageDesigner.module.scss";

const PREVIEW_MESSAGES: PreviewMessages = {update: EVENT_PREVIEW_MESSAGE, ready: EVENT_PREVIEW_READY};

const errorMessage = (error: any): string | null => {
    const errors = error?.response?.data?.errors;
    const first = errors && Object.values(errors).flat()[0];
    return (typeof first === 'string' ? first : null) ?? error?.response?.data?.message ?? null;
};

/**
 * The homepage designer, like the organizer's « Ma page »: the event's public page edited as a draft
 * with a live preview, then published at once. The public page only follows the accent (the cream
 * background and the dark text are fixed): the former mode, background and font settings are kept
 * as they were saved but no longer offered.
 */
const HomepageDesigner = () => {
    const {eventId} = useParams();
    const eventQuery = useGetEvent(eventId);
    const settingsQuery = useGetEventSettings(eventId);
    const imagesQuery = useGetEventImages(eventId);
    const event = eventQuery.data;
    const settings = settingsQuery.data;
    const images = imagesQuery.data;

    const updateEvent = useUpdateEvent();
    const updateSettings = useUpdateEventSettings();
    const uploadImage = useUploadImage();
    const deleteImage = useDeleteImage();

    const published = useMemo(
        () => event && settings && images ? publishedEventDraft(event, settings, images) : null,
        [event, settings, images],
    );
    const [draft, setDraft] = useState<EventPageDraft | null>(null);
    // Remounts the description editor when the draft is replaced.
    const [resetKey, setResetKey] = useState(0);
    const [openSections, setOpenSections] = useState<SectionId[]>([]);
    const [publishing, setPublishing] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    // eslint-disable-next-line lingui/no-unlocalized-strings
    const isWide = useMediaQuery('(min-width: 75em)', false, {getInitialValueInEffect: true});

    useEffect(() => {
        if (published && !draft) {
            setDraft(published);
        }
    }, [published]);

    const changes = useMemo(() => published && draft ? eventDraftChanges(published, draft) : null, [published, draft]);
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
        const warn = (beforeUnload: BeforeUnloadEvent) => beforeUnload.preventDefault();
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [changeCount > 0]);

    const previewDraft = useMemo<EventPreviewDraft>(() => draft ? {
        event: {title: draft.title, description: cleanDescription(draft.description)},
        accent: draft.accent,
        cover: draft.cover?.url ?? null,
        continue_button_text: draft.buttonText,
    } : {}, [draft]);

    const edit = (values: Partial<EventPageDraft>) => setDraft(current => current && {...current, ...values});

    const setCover = (cover: DraftImage) => setDraft(current => {
        const previous = current?.cover;
        if (previous?.kind === 'new' && previous.url !== cover?.url) {
            URL.revokeObjectURL(previous.url);
        }
        return current && {...current, cover};
    });

    const toggleSection = (id: SectionId) => setOpenSections(current =>
        current.includes(id) ? current.filter(section => section !== id) : [...current, id]);

    const openSection = (id: SectionId) => {
        setOpenSections(current => current.includes(id) ? current : [...current, id]);
        setTimeout(() => document.getElementById(`ma-page-${id}`)?.scrollIntoView({behavior: 'smooth', block: 'start'}), 220);
    };

    const replaceDraft = (next: EventPageDraft | null) => {
        if (draft?.cover?.kind === 'new') {
            URL.revokeObjectURL(draft.cover.url);
        }
        setDraft(next);
        setResetKey(key => key + 1);
    };

    const discard = () => published && replaceDraft(published);

    const publish = async () => {
        if (!draft || !published || !changes || !event || !settings || !eventId) {
            return;
        }
        if (!draft.title.trim()) {
            openSection('info');
            showError(t`Name is required`);
            return;
        }

        setPublishing(true);
        try {
            if (changes.cover) {
                if (draft.cover?.kind === 'new') {
                    // Replaces the previous cover (one per event).
                    const {data} = await uploadImage.mutateAsync({image: draft.cover.file, imageType: 'EVENT_COVER', entityId: eventId});
                    setCover({kind: 'saved', id: data.id, url: data.url});
                } else if (!draft.cover && published.cover?.kind === 'saved') {
                    await deleteImage.mutateAsync({imageId: published.cover.id});
                }
            }

            if (changes.event) {
                // The event is saved whole, as in its settings.
                await updateEvent.mutateAsync({
                    eventId,
                    eventData: {
                        title: draft.title.trim(),
                        description: cleanDescription(draft.description) || null,
                        start_date: utcToTz(event.start_date, event.timezone),
                        end_date: utcToTz(event.end_date, event.timezone) ?? null,
                        timezone: event.timezone,
                        currency: event.currency,
                        category: event.category || null,
                    } as Partial<Event>,
                });
            }

            if (changes.accent || changes.buttonText) {
                await updateSettings.mutateAsync({
                    eventId,
                    eventSettings: {
                        ...(changes.accent && {
                            homepage_theme_settings: {
                                ...settings.homepage_theme_settings,
                                accent: draft.accent,
                            } as HomepageThemeSettings,
                            // The former color field, still read by the widget's defaults.
                            homepage_primary_color: draft.accent,
                        }),
                        ...(changes.buttonText && {
                            continue_button_text: (draft.buttonText.trim() || null) as string,
                        }),
                    },
                });
            }

            const [freshEvent, freshSettings, freshImages] = await Promise.all([
                eventQuery.refetch(),
                settingsQuery.refetch(),
                imagesQuery.refetch(),
            ]);
            if (freshEvent.data && freshSettings.data && freshImages.data) {
                replaceDraft(publishedEventDraft(freshEvent.data, freshSettings.data, freshImages.data));
            }
            showSuccess(t`The event page is published`);
        } catch (error) {
            showError(errorMessage(error) ?? t`Some changes could not be published. Please try again.`);
            await Promise.all([eventQuery.refetch(), settingsQuery.refetch(), imagesQuery.refetch()]);
        } finally {
            setPublishing(false);
            queryClient.invalidateQueries({queryKey: [GET_EVENT_PUBLIC_QUERY_KEY, eventId]});
        }
    };

    const displayUrl = event ? eventHomepageUrl(event).replace(/^https?:\/\//, '') : '';
    const previewSrc = eventPreviewPath(eventId);
    const loading = !draft;

    const sections: { id: SectionId, icon: string, title: string, long: string, short: string }[] = [
        {id: 'images', icon: 'image', title: t`Images`, long: t`Cover image at the top of the page`, short: t`Cover Image`},
        {
            id: 'accent',
            icon: 'drop',
            title: t`Accent color`,
            long: t`Buttons and highlighted elements`,
            short: t`Buttons and highlighted elements`,
        },
        {
            id: 'info',
            icon: 'pen',
            title: t`Info and description`,
            long: t`Name and introduction text`,
            short: t`Name and introduction`,
        },
        {
            id: 'button',
            icon: '/interface/admin/parametres/billet.svg',
            title: t`Ticket button`,
            long: t`The text of the button under the tickets`,
            short: t`Text of the button`,
        },
    ];

    const sectionContent = (id: SectionId) => {
        if (!draft) {
            return null;
        }
        switch (id) {
            case 'images':
                return (
                    <ImagePicker
                        kind="cover"
                        label={t`Cover Image`}
                        recommendation={t`We recommend dimensions of 1950px by 650px, a ratio of 3:1, and a maximum file size of 30MB`}
                        image={draft.cover}
                        onChange={setCover}
                        disabled={publishing}
                    />
                );
            case 'accent':
                return <AccentSection accent={draft.accent} onChange={(accent) => edit({accent})} disabled={publishing}/>;
            case 'info':
                return (
                    <>
                        <TextInput
                            className={classes.field}
                            label={t`Name`}
                            value={draft.title}
                            maxLength={150}
                            disabled={publishing}
                            error={draft.title.trim() === '' ? t`Name is required` : undefined}
                            onChange={(changeEvent) => edit({title: changeEvent.currentTarget.value})}
                        />
                        <Editor
                            key={resetKey}
                            className={classes.description}
                            label={t`Description`}
                            value={draft.description}
                            onChange={(value) => edit({description: value})}
                        />
                    </>
                );
            case 'button':
                return (
                    <TextInput
                        className={classes.field}
                        label={t`Continue Button Text`}
                        description={t`Leave empty for « Continue ».`}
                        placeholder={t`e.g., Get Tickets, Register Now`}
                        maxLength={100}
                        value={draft.buttonText}
                        disabled={publishing}
                        onChange={(changeEvent) => edit({buttonText: changeEvent.currentTarget.value})}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className={classes.page}>
            <header className={classes.header}>
                <div className={classes.heading}>
                    <h1 className={classes.title}>{t`Event Page`}</h1>
                    <p className={classes.subtitle}>
                        {t`Customize the event's public page.`}
                        <span className={classes.wideOnly}> {t`Changes appear on the right.`}</span>
                    </p>
                </div>
                <div className={classes.headerActions}>
                    <Button
                        component="a"
                        href={event ? eventHomepagePath(event) : '#'}
                        target="_blank"
                        rel="noopener"
                        className={`${classes.button} ${classes.buttonOutline} ${classes.wideOnly}`}
                        leftSection={<img src="/interface/admin/ma-page/eye.svg" alt=""/>}
                    >
                        {t`View the page`}
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
                        <div className={classes.status} data-published aria-busy>
                            <SkeletonLine width={150} height={12}/>
                        </div>
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

                    {sections.map(section => (
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
                            open={!loading && openSections.includes(section.id)}
                            onToggle={loading ? () => undefined : toggleSection}
                        >
                            {!loading && sectionContent(section.id)}
                        </DesignerSection>
                    ))}
                </div>

                {isWide && (
                    <div className={classes.previewColumn}>
                        {loading
                            ? <PreviewSkeleton/>
                            : <PreviewPanel src={previewSrc} url={displayUrl} draft={previewDraft} messages={PREVIEW_MESSAGES}/>}
                    </div>
                )}
            </div>

            {!isWide && !loading && (
                <PreviewModal
                    opened={previewOpen}
                    onClose={() => setPreviewOpen(false)}
                    src={previewSrc}
                    draft={previewDraft}
                    messages={PREVIEW_MESSAGES}
                />
            )}
        </div>
    );
};

export default HomepageDesigner;
