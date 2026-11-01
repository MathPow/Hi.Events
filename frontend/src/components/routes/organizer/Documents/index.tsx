import {t, Trans} from "@lingui/macro";
import {useNavigate, useParams} from "react-router";
import {ActionIcon, Button, Menu, Skeleton} from "@mantine/core";
import {
    IconAlertCircle,
    IconArrowRight,
    IconCopy,
    IconDots,
    IconDownload,
    IconFileText,
    IconHelpCircle,
    IconPencil,
    IconPhoto,
    IconPlus,
    IconTrash,
    IconUser,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import {ReactNode} from "react";
import {PageBody} from "../../../common/PageBody";
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
import classes from "./Documents.module.scss";

const TEMPLATES: { key: DocumentTemplateKey, icon: ReactNode }[] = [
    {key: 'parental_consent', icon: <IconUser size={20} stroke={1.75}/>},
    {key: 'liability_waiver', icon: <IconFileText size={20} stroke={1.75}/>},
    {key: 'medical_form', icon: <IconAlertCircle size={20} stroke={1.75}/>},
    {key: 'photo_consent', icon: <IconPhoto size={20} stroke={1.75}/>},
    {key: 'blank', icon: <IconPlus size={20} stroke={1.75}/>},
];

/**
 * Les documents a faire signer aux participants (attestations, decharges,
 * formulaires): ceux de l'organisateur, et les modeles de base pour en commencer un.
 */
const Documents = () => {
    const {organizerId} = useParams();
    const navigate = useNavigate();
    const {data: documents, isLoading} = useGetOrganizerDocuments(organizerId);
    const createDocument = useCreateOrganizerDocument();

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
                    loading={createDocument.isPending && createDocument.variables?.template === null}
                    onClick={() => create(null)}
                >
                    {t`New document`}
                </Button>
            </div>

            <h2 className={classes.sectionTitle}>{t`Your documents`}</h2>
            {isLoading && (
                <div className={classes.grid}>
                    {[0, 1, 2].map(index => <Skeleton key={index} height={260} radius={24}/>)}
                </div>
            )}
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
                <div className={classes.templateGrid}>
                    {TEMPLATES.map(({key, icon}) => (
                        <button
                            key={key}
                            type="button"
                            className={classes.template}
                            data-blank={key === 'blank' || undefined}
                            disabled={createDocument.isPending}
                            onClick={() => create(key)}
                        >
                            <span className={classes.templateIcon}>{icon}</span>
                            <span className={classes.templateName}>{templateLabel(key)}</span>
                            <span className={classes.templateAction}>
                                {key === 'blank' ? t`Start` : t`Use`}
                                <IconArrowRight size={14}/>
                            </span>
                        </button>
                    ))}
                </div>
            </section>

            <div className={classes.legal}>
                <span className={classes.legalIcon}><IconHelpCircle size={20} stroke={1.75}/></span>
                <p>
                    <Trans>The templates are a starting point and do not replace legal advice. Make sure they suit your activity.</Trans>
                </p>
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
                <span className={classes.sheet} aria-hidden>
                    <span className={classes.sheetTitle}/>
                    <span/><span/><span/><span/><span/>
                    <span className={classes.sheetAccent}/>
                </span>
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
