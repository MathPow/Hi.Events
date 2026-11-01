import {useEffect, useMemo, useState} from "react";
import {useBlocker, useParams} from "react-router";
import {plural, t} from "@lingui/macro";
import {Button, Select, Skeleton, Text, TextInput} from "@mantine/core";
import {modals} from "@mantine/modals";
import {IconCheck, IconPrinter} from "@tabler/icons-react";
import {useGetEventSettings} from "../../../../queries/useGetEventSettings.ts";
import {GET_EVENT_IMAGES_QUERY_KEY, useGetEventImages} from "../../../../queries/useGetEventImages.ts";
import {useUpdateEventSettings} from "../../../../mutations/useUpdateEventSettings.ts";
import {useUploadImage} from "../../../../mutations/useUploadImage.ts";
import {useDeleteImage} from "../../../../mutations/useDeleteImage.ts";
import {EventSettings, Image} from "../../../../types.ts";
import {showError, showSuccess} from "../../../../utilites/notifications.tsx";
import {queryClient} from "../../../../utilites/queryClient.ts";
import {DraftImage} from "../../organizer/OrganizerHomepageDesigner/homepageDraft.ts";
import {DesignerSection, SectionId} from "../../organizer/OrganizerHomepageDesigner/DesignerSection.tsx";
import {ImagePicker} from "../../organizer/OrganizerHomepageDesigner/ImagesSection.tsx";
import {AccentSection} from "../../organizer/OrganizerHomepageDesigner/AccentSection.tsx";
import {TicketPreview} from "./TicketPreview";
import designer from "../../organizer/OrganizerHomepageDesigner/OrganizerHomepageDesigner.module.scss";
import classes from "./TicketDesigner.module.scss";

type DateDisplayMode = 'START_DATE_TIME' | 'DATE_RANGE' | 'HIDDEN';

interface TicketDraft {
    logo: DraftImage;
    accent: string;
    footer: string;
    dateDisplay: DateDisplayMode;
}

const DEFAULT_TICKET_ACCENT = '#333333';

const savedDraft = (settings: EventSettings, images: Image[] = []): TicketDraft => {
    const logo = images.find(image => image.type === 'TICKET_LOGO');
    const design = settings.ticket_design_settings;
    return {
        logo: logo?.id ? {kind: 'saved', id: logo.id, url: logo.url} : null,
        accent: design?.accent_color || DEFAULT_TICKET_ACCENT,
        footer: design?.footer_text ?? '',
        dateDisplay: design?.date_display_mode || 'START_DATE_TIME',
    };
};

const draftChanges = (saved: TicketDraft, draft: TicketDraft) => {
    const logo = saved.logo?.url !== draft.logo?.url;
    const accent = saved.accent.toLowerCase() !== draft.accent.toLowerCase();
    const footer = saved.footer.trim() !== draft.footer.trim();
    const dateDisplay = saved.dateDisplay !== draft.dateDisplay;
    return {logo, count: [logo, accent, footer, dateDisplay].filter(Boolean).length};
};

/**
 * « Personnalisation de billets », like the homepage designer: the ticket's logo, color, date and
 * footer as a draft, the ticket beside it, then saved at once.
 */
const TicketDesigner = () => {
    const {eventId} = useParams();
    const settingsQuery = useGetEventSettings(eventId);
    const imagesQuery = useGetEventImages(eventId);
    const updateSettings = useUpdateEventSettings();
    const uploadImage = useUploadImage();
    const deleteImage = useDeleteImage();
    const settings = settingsQuery.data;
    const images = imagesQuery.data;

    const saved = useMemo(() => settings && images ? savedDraft(settings, images) : null, [settings, images]);
    const [draft, setDraft] = useState<TicketDraft | null>(null);
    const [openSections, setOpenSections] = useState<SectionId[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (saved && !draft) {
            setDraft(saved);
        }
    }, [saved]);

    const changes = useMemo(() => saved && draft ? draftChanges(saved, draft) : null, [saved, draft]);
    const changeCount = changes?.count ?? 0;

    const blocker = useBlocker(({currentLocation, nextLocation}) =>
        changeCount > 0 && !saving && currentLocation.pathname !== nextLocation.pathname);

    useEffect(() => {
        if (blocker.state !== 'blocked') {
            return;
        }
        let leaving = false;
        modals.openConfirmModal({
            title: t`Leave without saving?`,
            children: <Text size="sm">{t`Your unsaved changes will be lost.`}</Text>,
            labels: {confirm: t`Leave`, cancel: t`Stay`},
            onConfirm: () => {
                leaving = true;
                blocker.proceed?.();
            },
            onClose: () => !leaving && blocker.reset?.(),
        });
    }, [blocker.state]);

    const edit = (values: Partial<TicketDraft>) => setDraft(current => current && {...current, ...values});

    const setLogo = (logo: DraftImage) => setDraft(current => {
        const previous = current?.logo;
        if (previous?.kind === 'new' && previous.url !== logo?.url) {
            URL.revokeObjectURL(previous.url);
        }
        return current && {...current, logo};
    });

    const replaceDraft = (next: TicketDraft | null) => {
        if (draft?.logo?.kind === 'new') {
            URL.revokeObjectURL(draft.logo.url);
        }
        setDraft(next);
    };

    const toggleSection = (id: SectionId) => setOpenSections(current =>
        current.includes(id) ? current.filter(section => section !== id) : [...current, id]);

    const save = async () => {
        if (!draft || !saved || !changes || !settings || !eventId) {
            return;
        }

        setSaving(true);
        try {
            let logoId = saved.logo?.kind === 'saved' ? saved.logo.id : null;
            if (changes.logo) {
                if (draft.logo?.kind === 'new') {
                    // Replaces the previous logo (one per event).
                    const {data} = await uploadImage.mutateAsync({image: draft.logo.file, imageType: 'TICKET_LOGO', entityId: eventId});
                    logoId = data.id;
                    setLogo({kind: 'saved', id: data.id, url: data.url});
                } else if (!draft.logo && saved.logo?.kind === 'saved') {
                    await deleteImage.mutateAsync({imageId: saved.logo.id});
                    logoId = null;
                }
            }

            await updateSettings.mutateAsync({
                eventId,
                eventSettings: {
                    ticket_design_settings: {
                        ...settings.ticket_design_settings,
                        accent_color: draft.accent,
                        logo_image_id: logoId ?? undefined,
                        footer_text: draft.footer.trim() || undefined,
                        date_display_mode: draft.dateDisplay,
                        enabled: settings.ticket_design_settings?.enabled !== false,
                    },
                },
            });

            const [freshSettings, freshImages] = await Promise.all([settingsQuery.refetch(), imagesQuery.refetch()]);
            if (freshSettings.data && freshImages.data) {
                replaceDraft(savedDraft(freshSettings.data, freshImages.data));
            }
            showSuccess(t`Ticket design saved successfully`);
        } catch (error: any) {
            showError(error?.response?.data?.message ?? t`Some changes could not be saved. Please try again.`);
            await Promise.all([settingsQuery.refetch(), imagesQuery.refetch()]);
        } finally {
            setSaving(false);
            queryClient.invalidateQueries({queryKey: [GET_EVENT_IMAGES_QUERY_KEY, eventId]});
        }
    };

    const dateOptions: { value: DateDisplayMode, label: string }[] = [
        {value: 'START_DATE_TIME', label: t`Only show start date and time`},
        {value: 'DATE_RANGE', label: t`Show entire date range`},
        {value: 'HIDDEN', label: t`Hide the date`},
    ];

    const loading = !draft;

    const sections: { id: SectionId, icon: string, title: string, subtitle: string }[] = [
        {id: 'images', icon: 'image', title: t`Logo`, subtitle: t`At the top of the ticket`},
        {id: 'accent', icon: 'drop', title: t`Accent color`, subtitle: t`Borders, highlights and QR code`},
        {
            id: 'info',
            icon: '/interface/admin/parametres/billet.svg',
            title: t`Event date display`,
            subtitle: dateOptions.find(option => option.value === draft?.dateDisplay)?.label ?? '',
        },
        {id: 'button', icon: 'pen', title: t`Ticket footer`, subtitle: t`A line at the bottom of the ticket`},
    ];

    const sectionContent = (id: SectionId) => {
        if (!draft) {
            return null;
        }
        switch (id) {
            case 'images':
                return (
                    <ImagePicker
                        kind="logo"
                        label={t`Logo`}
                        recommendation={t`We recommend a square logo with minimum dimensions of 200x200px`}
                        image={draft.logo}
                        onChange={setLogo}
                        disabled={saving}
                    />
                );
            case 'accent':
                return <AccentSection accent={draft.accent} onChange={(accent) => edit({accent})} disabled={saving} readability={false}/>;
            case 'info':
                return (
                    <Select
                        className={designer.field}
                        label={t`Event date display`}
                        allowDeselect={false}
                        data={dateOptions}
                        value={draft.dateDisplay}
                        disabled={saving}
                        onChange={(value) => value && edit({dateDisplay: value as DateDisplayMode})}
                    />
                );
            case 'button':
                return (
                    <TextInput
                        className={designer.field}
                        label={t`Ticket footer`}
                        description={t`Optional text for disclaimers, contact info, or thank you notes (single line only)`}
                        placeholder={t`Thank you for attending!`}
                        maxLength={500}
                        value={draft.footer}
                        disabled={saving}
                        rightSection={<span className={classes.counter}>{draft.footer.length}/500</span>}
                        rightSectionWidth={64}
                        onChange={(changeEvent) => edit({footer: changeEvent.currentTarget.value.replace(/\n/g, ' ')})}
                    />
                );
            default:
                return null;
        }
    };

    const printPreview = () => window.open(`/manage/event/${eventId}/ticket-designer/print`, '_blank');

    return (
        <div className={designer.page}>
            <header className={designer.header}>
                <div className={designer.heading}>
                    <h1 className={designer.title}>{t`Ticket Designer`}</h1>
                    <p className={designer.subtitle}>{t`Brand your tickets with a custom logo, colors, and footer message.`}</p>
                </div>
                <div className={designer.headerActions}>
                    <Button
                        className={`${designer.button} ${designer.buttonOutline}`}
                        leftSection={<IconPrinter size={20} stroke={2}/>}
                        onClick={printPreview}
                    >
                        <span className={designer.longLabel}>{t`Print preview`}</span>
                        <span className={designer.shortLabel}>{t`Print`}</span>
                    </Button>
                    <Button
                        className={`${designer.button} ${designer.buttonFilled}`}
                        leftSection={<IconCheck size={20} stroke={2.25}/>}
                        onClick={save}
                        loading={saving}
                        disabled={changeCount === 0}
                    >
                        <span className={designer.longLabel}>{t`Save changes`}</span>
                        <span className={designer.shortLabel}>{t`Save`}</span>
                    </Button>
                </div>
            </header>

            <div className={`${designer.designer} ${classes.designer}`}>
                <div className={designer.settings}>
                    {loading ? (
                        <Skeleton height={46} radius={20}/>
                    ) : (
                        <div className={designer.status} data-published={changeCount === 0 || undefined} role="status">
                            <span className={designer.statusDot}/>
                            <span className={designer.statusText}>
                                {changeCount > 0
                                    ? plural(changeCount, {
                                        one: '# change not yet saved',
                                        other: '# changes not yet saved',
                                    })
                                    : t`Everything is saved`}
                            </span>
                            {changeCount > 0 && (
                                <button type="button" className={`${designer.textButton} ${designer.discard}`}
                                        onClick={() => saved && replaceDraft(saved)} disabled={saving}>
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
                            subtitle={section.subtitle}
                            open={openSections.includes(section.id)}
                            onToggle={toggleSection}
                        >
                            {sectionContent(section.id)}
                        </DesignerSection>
                    ))}
                </div>

                <section className={classes.preview} aria-label={t`Preview`}>
                    <div className={classes.previewHead}>
                        <span className={classes.previewTitle}>{t`Preview`}</span>
                        <span className={classes.previewHint}>{t`With your name and a sample ticket.`}</span>
                    </div>
                    <div className={classes.previewBody} data-dehors-apercu>
                        {draft && eventId ? (
                            <TicketPreview
                                eventId={eventId}
                                settings={{
                                    accent_color: draft.accent,
                                    logo_image_id: draft.logo ? (draft.logo.kind === 'saved' ? draft.logo.id : 'draft') : null,
                                    footer_text: draft.footer,
                                    date_display_mode: draft.dateDisplay,
                                    enabled: true,
                                }}
                                logoUrl={draft.logo?.url}
                            />
                        ) : <Skeleton height={360} radius={20}/>}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default TicketDesigner;
