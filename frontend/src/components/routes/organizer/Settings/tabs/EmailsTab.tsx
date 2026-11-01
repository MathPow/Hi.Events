import {useState} from "react";
import {t} from "@lingui/macro";
import {Button, Loader, Modal} from "@mantine/core";
import {useQueryClient} from "@tanstack/react-query";
import {CreateEmailTemplateRequest, EmailTemplate, EmailTemplateType, IdParam, UpdateEmailTemplateRequest} from "../../../../../types.ts";
import {useGetAccount} from "../../../../../queries/useGetAccount.ts";
import {useGetEmailTemplatesForOrganizer} from "../../../../../queries/useGetEmailTemplates.ts";
import {useGetDefaultEmailTemplates} from "../../../../../queries/useGetDefaultEmailTemplates.ts";
import {GET_ORGANIZER_SAMPLE_EMAIL_QUERY_KEY, useGetOrganizerSampleEmail} from "../../../../../queries/useGetOrganizerSampleEmail.ts";
import {useCreateEmailTemplateForOrganizer} from "../../../../../mutations/useCreateEmailTemplate.ts";
import {useUpdateEmailTemplateForOrganizer} from "../../../../../mutations/useUpdateEmailTemplate.ts";
import {useDeleteEmailTemplateForOrganizer} from "../../../../../mutations/useDeleteEmailTemplate.ts";
import {usePreviewEmailTemplateForOrganizer} from "../../../../../mutations/usePreviewEmailTemplate.ts";
import {useSendOrganizerTestEmail} from "../../../../../mutations/useSendOrganizerTestEmail.ts";
import {useIsCurrentUserAdmin} from "../../../../../hooks/useIsCurrentUserAdmin.ts";
import {showError, showSuccess} from "../../../../../utilites/notifications.tsx";
import {confirmationDialog} from "../../../../../utilites/confirmationDialog.tsx";
import {EmailTemplateEditor} from "../../../../common/EmailTemplateEditor";
import {StripeConnectButton} from "../../../../common/StripeConnectButton";
import {SettingsCard, showServerErrors, Tag} from "../SettingsUi.tsx";
import classes from "../Settings.module.scss";

interface AutomaticEmail {
    type: EmailTemplateType;
    title: string;
    hint: string;
    icon: string;
    // The info filled in by itself, as the organizer would name it (no template syntax).
    automaticInfo: string[];
}

const automaticEmails = (): AutomaticEmail[] => [
    {
        type: 'order_confirmation',
        title: t`Order Confirmation`,
        hint: t`To the buyer, after the purchase`,
        icon: 'recu',
        automaticInfo: [t`First name`, t`Event`, t`Date`, t({message: 'Location', context: 'place'}), t`Link to the order`],
    },
    {
        type: 'attendee_ticket',
        title: t`Attendee's ticket`,
        hint: t`To each attendee, with their ticket`,
        icon: 'billet',
        automaticInfo: [t`Attendee name`, t`Event`, t`Date`, t({message: 'Location', context: 'place'}), t`Link to the ticket`],
    },
];

// The sample email in a frame as tall as its content; links open in a new tab.
const EmailFrame = ({html, title}: { html: string, title: string }) => {
    const [height, setHeight] = useState(640);

    return (
        <iframe
            title={title}
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            srcDoc={html.replace(/<head>/i, '<head><base target="_blank">')}
            style={{height}}
            onLoad={(event) => {
                const body = event.currentTarget.contentDocument?.body;
                if (body) {
                    setHeight(body.scrollHeight + 8);
                }
            }}
        />
    );
};

/**
 * « Courriels »: the automatic emails on the left, the selected one on the right exactly as it is sent
 * (sample buyer, latest event), with « Modifier » and « Envoyer un test » (sent to yourself).
 */
export const EmailsTab = ({organizerId}: { organizerId: IdParam }) => {
    const queryClient = useQueryClient();
    const {data: account, isFetched: isAccountFetched} = useGetAccount();
    const isAdmin = useIsCurrentUserAdmin();
    const emails = automaticEmails();
    const [selectedType, setSelectedType] = useState<EmailTemplateType>('order_confirmation');
    const [editorOpen, setEditorOpen] = useState(false);
    const selected = emails.find(email => email.type === selectedType) ?? emails[0];

    const templatesQuery = useGetEmailTemplatesForOrganizer(organizerId, {include_inactive: true});
    const templates = templatesQuery.data?.data ?? [];
    const sampleQuery = useGetOrganizerSampleEmail(organizerId, selectedType);
    const defaultTemplatesQuery = useGetDefaultEmailTemplates(editorOpen);
    const createMutation = useCreateEmailTemplateForOrganizer();
    const updateMutation = useUpdateEmailTemplateForOrganizer();
    const deleteMutation = useDeleteEmailTemplateForOrganizer();
    const previewMutation = usePreviewEmailTemplateForOrganizer();
    const testMutation = useSendOrganizerTestEmail();

    const templateOf = (type: EmailTemplateType): EmailTemplate | undefined =>
        templates.find(template => template.template_type === type);
    const selectedTemplate = templateOf(selectedType);

    // The same rules as the server (BaseEmailTemplateAction): a confirmed email, and in Saas mode an
    // account verified by connecting Stripe, against spam.
    const needsEmailConfirmation = isAccountFetched && !account?.is_account_email_confirmed;
    const needsStripe = isAccountFetched && !!account?.requires_manual_verification;
    const canModify = isAccountFetched && !needsEmailConfirmation && !needsStripe;

    const refreshSample = () => queryClient.invalidateQueries({queryKey: [GET_ORGANIZER_SAMPLE_EMAIL_QUERY_KEY, organizerId]});

    const handleSave = (data: CreateEmailTemplateRequest | UpdateEmailTemplateRequest, editorForm?: any) => {
        const onError = (error: any) => {
            if (error?.response?.data?.errors?.body && editorForm) {
                editorForm.setFieldError('body', t`Some automatic info is badly written. Please correct it and try again.`);
            } else if (editorForm) {
                showServerErrors(editorForm, error);
            }
            showError(t`Failed to save template`);
        };
        const onSuccess = () => {
            showSuccess(t`Template saved successfully`);
            setEditorOpen(false);
            refreshSample();
        };

        if (selectedTemplate) {
            updateMutation.mutate({
                organizerId,
                templateId: selectedTemplate.id,
                templateData: data as UpdateEmailTemplateRequest,
            }, {onSuccess, onError});
        } else {
            createMutation.mutate({organizerId, templateData: data as CreateEmailTemplateRequest}, {onSuccess, onError});
        }
    };

    const backToDefault = (template: EmailTemplate) => confirmationDialog(
        t`Go back to the default version of this email? Your version will be deleted.`,
        () => deleteMutation.mutate({organizerId, templateId: template.id}, {
            onSuccess: () => {
                showSuccess(t`Template deleted successfully`);
                refreshSample();
            },
            onError: () => showError(t`Failed to delete template`),
        }),
        {confirm: t`Use the default version`, cancel: t`Cancel`},
    );

    const sendTest = () => testMutation.mutate({organizerId, templateType: selectedType}, {
        onSuccess: ({sent_to}) => showSuccess(t`Test sent to ${sent_to}`),
        onError: (error: any) => showError(error?.response?.status === 429
            ? t`Too many tests in a row. Please try again in a few minutes.`
            : t`The test could not be sent. Please try again.`),
    });

    return (
        <div className={classes.stack}>
            {(needsStripe || needsEmailConfirmation) && (
                <div className={classes.banner}>
                    <span className={`${classes.pastille} ${classes.pastilleAccent}`}>
                        <img src="/interface/admin/parametres/cadenas.svg" alt=""/>
                    </span>
                    <div className={classes.bannerText}>
                        <span className={classes.bannerTitle}>
                            {needsEmailConfirmation
                                ? t`Confirm your email address to customize your emails`
                                : t`Connect Stripe to customize your emails`}
                        </span>
                        <span className={classes.bannerHint}>
                            {needsEmailConfirmation
                                ? t`The default emails are sent anyway.`
                                : t`To prevent spam, only verified organizers can change the emails. The default emails are sent anyway.`}
                        </span>
                    </div>
                    {!needsEmailConfirmation && isAdmin && (
                        <StripeConnectButton className={classes.inkButton} buttonIcon={null} variant="transparent" buttonText={t`Connect Stripe`}/>
                    )}
                </div>
            )}

            <div className={classes.emailsLayout}>
                <SettingsCard
                    className={classes.emailList}
                    title={t`Automatic emails`}
                    subtitle={t`Sent for all your events. An event can have its own version.`}
                >
                    {emails.map(email => {
                        const template = templateOf(email.type);
                        const custom = !!template?.is_active;
                        return (
                            <button
                                key={email.type}
                                type="button"
                                className={classes.emailItem}
                                aria-current={email.type === selectedType}
                                onClick={() => setSelectedType(email.type)}
                            >
                                <span className={classes.pastille}>
                                    <img src={`/interface/admin/parametres/${email.icon}.svg`} alt=""/>
                                </span>
                                <span className={classes.emailItemText}>
                                    <span className={classes.emailItemTitle}>{email.title}</span>
                                    <span className={classes.emailItemHint}>{email.hint}</span>
                                </span>
                                {custom
                                    ? <Tag tone="green">{t`Customized`}</Tag>
                                    : <Tag tone="neutral">{t`Default`}</Tag>}
                            </button>
                        );
                    })}
                </SettingsCard>

                <section className={`${classes.card} ${classes.previewCard}`}>
                    <div className={classes.previewHead}>
                        <div className={classes.previewHeadText}>
                            <span className={classes.overline}>{t`Preview`}</span>
                            <span className={classes.previewTitle}>{selected.title}</span>
                        </div>
                        <Button
                            variant="transparent"
                            className={classes.outlineButton}
                            leftSection={<img src="/interface/admin/parametres/courriel.svg" alt=""/>}
                            onClick={sendTest}
                            loading={testMutation.isPending}
                            disabled={!sampleQuery.data}
                        >
                            {t`Send a test`}
                        </Button>
                        <Button
                            variant="transparent"
                            className={classes.accentButton}
                            leftSection={<img src="/interface/admin/parametres/crayon.svg" alt=""/>}
                            onClick={() => setEditorOpen(true)}
                            disabled={!canModify || templatesQuery.isLoading}
                        >
                            {t`Edit`}
                        </Button>
                    </div>

                    <div className={classes.subjectRow}>
                        <strong>{t({message: 'Subject:', context: 'email'})}</strong>
                        <span>{sampleQuery.data?.subject ?? '…'}</span>
                    </div>

                    <div className={classes.emailFrame}>
                        {sampleQuery.data
                            ? <EmailFrame key={selectedType} html={sampleQuery.data.html} title={selected.title}/>
                            : sampleQuery.isError
                                ? <p className={classes.empty}>{t`The preview could not be loaded.`}</p>
                                : <div style={{display: 'grid', placeItems: 'center', minHeight: '12rem'}}><Loader size="sm" color="dark"/></div>}
                    </div>

                    <p className={classes.softHint}>
                        {t`With a sample buyer and your latest event. The test is sent to your own email address.`}
                    </p>

                    <div className={classes.tokens}>
                        <span className={classes.fieldLabel} style={{fontSize: '0.9375rem'}}>{t`Info added automatically`}</span>
                        <div className={classes.tokenList}>
                            {selected.automaticInfo.map(info => <span key={info} className={classes.token}>{info}</span>)}
                        </div>
                    </div>

                    {selectedTemplate && canModify && (
                        <button type="button" className={classes.textButton} onClick={() => backToDefault(selectedTemplate)}
                                disabled={deleteMutation.isPending}>
                            {t`Go back to the default version`}
                        </button>
                    )}
                </section>
            </div>

            <Modal opened={editorOpen} onClose={() => setEditorOpen(false)} size="xl" withCloseButton={false} padding="xl">
                <EmailTemplateEditor
                    key={`${selectedType}-${selectedTemplate?.id ?? 'new'}`}
                    templateType={selectedType}
                    template={selectedTemplate}
                    defaultTemplate={defaultTemplatesQuery.data?.[selectedType]}
                    onSave={handleSave}
                    onPreview={(data) => previewMutation.mutate({organizerId, previewData: data})}
                    onClose={() => setEditorOpen(false)}
                    isSaving={createMutation.isPending || updateMutation.isPending}
                    isPreviewLoading={previewMutation.isPending}
                    previewData={previewMutation.data}
                />
            </Modal>
        </div>
    );
};
