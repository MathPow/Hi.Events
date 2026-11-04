import {t, Trans} from "@lingui/macro";
import {useNavigate, useParams} from "react-router";
import {ActionIcon, Button, Loader, Menu, Skeleton} from "@mantine/core";
import {
    IconArrowRight,
    IconCopy,
    IconDots,
    IconDownload,
    IconFileText,
    IconAlertTriangle,
    IconPencil,
    IconPlus,
    IconTrash,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import {useState} from "react";
import {PageBody} from "../../../common/PageBody";
import {SkeletonLine, SkeletonPill} from "../../../common/Skeletons";
import {PageTitle} from "../../../common/PageTitle";
import {useGetOrganizerDocuments} from "../../../../queries/useGetOrganizerDocuments.ts";
import {
    useCreateOrganizerDocument,
    useDeleteOrganizerDocument,
    useDuplicateOrganizerDocument,
} from "../../../../mutations/useOrganizerDocumentMutations.ts";
import {DocumentTemplateKey, OrganizerDocument} from "../../../../api/organizerDocument.client.ts";
import {exportDocumentPdf} from "./exportDocumentPdf.ts";
import {templateLabel} from "../../../common/OrganizerDocument/blocks.ts";
import {confirmationDialog} from "../../../../utilites/confirmationDialog.tsx";
import {showError, showSuccess} from "../../../../utilites/notifications.tsx";
import {getClientLocale} from "../../../../locales.ts";
import {Modal} from "../../../common/Modal";
import {DocumentThumbnail} from "./DocumentThumbnail.tsx";
import classes from "./Documents.module.scss";

const TEMPLATES: DocumentTemplateKey[] = ['parental_consent', 'liability_waiver', 'medical_form', 'photo_consent', 'blank'];

// The starting templates, each with its little page: on the page, and in the « New document » popup.
const TemplateChoices = ({onPick, pendingKey, compact = false}: {
    onPick: (key: DocumentTemplateKey) => void,
    pendingKey: DocumentTemplateKey | null | undefined,
    compact?: boolean,
}) => (
    <div className={compact ? `${classes.templateGrid} ${classes.templateGridCompact}` : classes.templateGrid}>
        {TEMPLATES.map((key) => (
            <button
                key={key}
                type="button"
                className={classes.template}
                disabled={pendingKey !== undefined}
                onClick={() => onPick(key)}
            >
                <DocumentThumbnail template={key} className={classes.templateThumb}/>
                <span className={classes.templateText}>
                    <span className={classes.templateName}>{templateLabel(key)}</span>
                    <span className={classes.templateAction}>
                        {key === 'blank' ? t`Start` : t`Use`}
                        {pendingKey === key ? <Loader size={12} color="currentColor"/> : <IconArrowRight size={14}/>}
                    </span>
                </span>
            </button>
        ))}
    </div>
);

// Document cards: a sand sheet, the title and its menu, the links line and the signing badge.
const DocumentsSkeleton = () => (
    <div className={classes.grid} aria-busy>
        {[0, 1, 2].map(index => (
            <div key={index} className={index === 2 ? `${classes.card} ${classes.skeletonExtra}` : classes.card}>
                <Skeleton className={classes.thumbnail} width="auto" radius={18} style={{cursor: 'default'}}/>
                <div className={classes.cardBody}>
                    <div className={classes.cardTitleRow}>
                        <SkeletonLine width={['62%', '74%', '54%'][index]} height={16}/>
                        <SkeletonLine width={16} height={6}/>
                    </div>
                    <SkeletonLine width={['70%', '58%', '76%'][index]} height={10}/>
                    <SkeletonPill width={index % 2 ? 92 : 112} height={20}/>
                </div>
            </div>
        ))}
    </div>
);

/**
 * Les documents a faire signer aux participants (attestations, decharges,
 * formulaires): ceux de l'organisateur, et les modeles de base pour en commencer un.
 */
const Documents = () => {
    const {organizerId} = useParams();
    const navigate = useNavigate();
    const {data: documents, isLoading} = useGetOrganizerDocuments(organizerId);
    const createDocument = useCreateOrganizerDocument();
    const [choosing, setChoosing] = useState(false);
    // The template being created, for its card's spinner (undefined: none).
    const pendingKey = createDocument.isPending ? createDocument.variables?.template : undefined;

    const editorPath = (documentId: number) => `/manage/organizer/${organizerId}/documents/${documentId}`;

    const create = (template: DocumentTemplateKey | null) => createDocument.mutate({organizerId, template}, {
        onSuccess: (document) => navigate(editorPath(document.id)),
        onError: () => showError(t`The document could not be created. Please try again.`),
    });

    return (
        <PageBody>
            <div className={classes.header}>
                <PageTitle subheading={t`Waivers, consent forms and other documents for your participants to sign.`}>
                    {t`Documents`}
                </PageTitle>
                <Button
                    className={classes.newButton}
                    leftSection={<IconPlus size={18}/>}
                    onClick={() => setChoosing(true)}
                >
                    {t`New document`}
                </Button>
            </div>

            {/* « New document »: a template first (or the blank page). */}
            <Modal opened={choosing} onClose={() => setChoosing(false)} heading={t`New document`}>
                <p className={classes.pickerIntro}>
                    <Trans>Start from a template, then adapt it to your event.</Trans>
                </p>
                <TemplateChoices onPick={create} pendingKey={pendingKey} compact/>
            </Modal>

            <h2 className={classes.sectionTitle}>{t`Your documents`}</h2>
            {isLoading && <DocumentsSkeleton/>}
            {!isLoading && !documents?.length && (
                <div className={classes.empty}>
                    <IconFileText size={28} stroke={1.5}/>
                    <p><Trans>No documents yet. Start from one of the templates below.</Trans></p>
                </div>
            )}
            {!!documents?.length && (
                <div className={classes.grid}>
                    {documents.map(document => (
                        <DocumentCard key={document.id} document={document} onOpen={() => navigate(editorPath(document.id))}/>
                    ))}
                </div>
            )}

            <section className={classes.templates}>
                <h2 className={classes.sectionTitle}>{t`Starting templates`}</h2>
                <p className={classes.templatesIntro}>
                    <Trans>Prepared by Billetterie Dehors. Pick one, then adapt it to your event.</Trans>
                </p>
                <TemplateChoices onPick={create} pendingKey={pendingKey}/>
            </section>

            <div className={classes.legal} role="note">
                <IconAlertTriangle size={22} stroke={1.75} className={classes.legalIcon}/>
                <div className={classes.legalText}>
                    <strong>{t`This is not legal advice`}</strong>
                    <p>
                        <Trans>The templates are a starting point. Make sure they suit your activity before using them.</Trans>
                    </p>
                </div>
            </div>
        </PageBody>
    );
};

const DocumentCard = ({document, onOpen}: { document: OrganizerDocument, onOpen: () => void }) => {
    const {organizerId} = useParams();
    const duplicate = useDuplicateOrganizerDocument();
    const remove = useDeleteOrganizerDocument();
    const linkedCount = document.event_ids.length;
    const modified = dayjs(document.updated_at).locale(getClientLocale()).format('D MMM');
    const title = document.title;

    const linked = linkedCount === 0
        ? t`Linked to no event`
        : linkedCount === 1 ? t`Linked to 1 event` : t`Linked to ${linkedCount} events`;

    return (
        <article className={classes.card}>
            <button type="button" className={classes.thumbnail} onClick={onOpen} aria-label={t`Edit ${title}`}>
                <DocumentThumbnail template={document.template}/>
            </button>
            <div className={classes.cardBody}>
                <div className={classes.cardTitleRow}>
                    <button type="button" className={classes.cardTitle} onClick={onOpen}>{document.title}</button>
                    <Menu position="bottom-end" withinPortal>
                        <Menu.Target>
                            <ActionIcon variant="subtle" color="dark" aria-label={t`More actions`}>
                                <IconDots size={18}/>
                            </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Item leftSection={<IconPencil size={16}/>} onClick={onOpen}>{t`Edit`}</Menu.Item>
                            <Menu.Item
                                leftSection={<IconCopy size={16}/>}
                                onClick={() => duplicate.mutate({organizerId, documentId: document.id}, {
                                    onSuccess: () => showSuccess(t`Document duplicated`),
                                    onError: () => showError(t`The document could not be duplicated.`),
                                })}
                            >
                                {t`Duplicate`}
                            </Menu.Item>
                            <Menu.Item leftSection={<IconDownload size={16}/>} onClick={() => exportDocumentPdf(organizerId, document)}>
                                {t`Export as PDF`}
                            </Menu.Item>
                            <Menu.Divider/>
                            <Menu.Item
                                color="red"
                                leftSection={<IconTrash size={16}/>}
                                onClick={() => confirmationDialog(
                                    t`Delete « ${title} »? Copies already signed stay with their participants.`,
                                    () => remove.mutate({organizerId, documentId: document.id}, {
                                        onSuccess: () => showSuccess(t`Document deleted`),
                                        onError: () => showError(t`The document could not be deleted.`),
                                    }),
                                )}
                            >
                                {t`Delete`}
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                </div>
                <p className={classes.cardMeta}>{linked} · {t`modified on ${modified}`}</p>
                <span className={classes.badge} data-mode={document.signing_mode}>
                    {document.signing_mode === 'ONLINE' ? t`Online signature` : t`PDF to print`}
                </span>
            </div>
        </article>
    );
};

export default Documents;
