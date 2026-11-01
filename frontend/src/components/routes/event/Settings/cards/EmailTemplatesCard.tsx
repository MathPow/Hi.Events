import {useState} from "react";
import {Link} from "react-router";
import {t} from "@lingui/macro";
import {Button, Modal, Skeleton} from "@mantine/core";
import {
    CreateEmailTemplateRequest,
    DefaultEmailTemplate,
    EmailTemplate,
    EmailTemplateType,
    Event,
    IdParam,
    UpdateEmailTemplateRequest,
} from "../../../../../types.ts";
import {useGetAccount} from "../../../../../queries/useGetAccount.ts";
import {useGetEmailTemplatesForEvent, useGetEmailTemplatesForOrganizer} from "../../../../../queries/useGetEmailTemplates.ts";
import {useGetDefaultEmailTemplates} from "../../../../../queries/useGetDefaultEmailTemplates.ts";
import {useCreateEmailTemplateForEvent} from "../../../../../mutations/useCreateEmailTemplate.ts";
import {useUpdateEmailTemplateForEvent} from "../../../../../mutations/useUpdateEmailTemplate.ts";
import {useDeleteEmailTemplateForEvent} from "../../../../../mutations/useDeleteEmailTemplate.ts";
import {usePreviewEmailTemplateForEvent} from "../../../../../mutations/usePreviewEmailTemplate.ts";
import {useIsCurrentUserAdmin} from "../../../../../hooks/useIsCurrentUserAdmin.ts";
import {showError, showSuccess} from "../../../../../utilites/notifications.tsx";
import {confirmationDialog} from "../../../../../utilites/confirmationDialog.tsx";
import {EmailTemplateEditor} from "../../../../common/EmailTemplateEditor";
import {StripeConnectButton} from "../../../../common/StripeConnectButton";
import {SettingsCard, showServerErrors, Tag} from "../../../organizer/Settings/SettingsUi.tsx";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

const EMAILS: { type: EmailTemplateType, icon: string, title: () => string, hint: () => string }[] = [
    {type: 'order_confirmation', icon: 'recu', title: () => t`Order Confirmation`, hint: () => t`To the buyer, after the purchase`},
    {type: 'attendee_ticket', icon: 'billet', title: () => t`Attendee's ticket`, hint: () => t`To each attendee, with their ticket`},
];

/**
 * « Courriels automatiques » of this event: by default the organizer's version is sent (Paramètres →
 * Courriels); the event can have its own, which starts from it.
 */
export const EmailTemplatesCard = ({eventId, event}: { eventId: IdParam, event: Event }) => {
    const organizerId = event.organizer?.id as IdParam;
    const {data: account, isFetched: isAccountFetched} = useGetAccount();
    const isAdmin = useIsCurrentUserAdmin();
    const [editing, setEditing] = useState<EmailTemplateType | null>(null);

    const templatesQuery = useGetEmailTemplatesForEvent(eventId, {include_inactive: true});
    const organizerTemplatesQuery = useGetEmailTemplatesForOrganizer(organizerId, {include_inactive: true});
    const defaultTemplatesQuery = useGetDefaultEmailTemplates(editing !== null);
    const createMutation = useCreateEmailTemplateForEvent();
    const updateMutation = useUpdateEmailTemplateForEvent();
    const deleteMutation = useDeleteEmailTemplateForEvent();
    const previewMutation = usePreviewEmailTemplateForEvent();

    const eventTemplate = (type: EmailTemplateType): EmailTemplate | undefined => (templatesQuery.data?.data ?? [])
        .find(template => template.template_type === type && (!template.event_id || String(template.event_id) === String(eventId)));
    const organizerTemplate = (type: EmailTemplateType): EmailTemplate | undefined => (organizerTemplatesQuery.data?.data ?? [])
        .find(template => template.template_type === type && template.is_active && !template.event_id);

    // The same rules as the server (BaseEmailTemplateAction): a confirmed email, and in Saas mode an
    // account verified by connecting Stripe, against spam.
    const needsEmailConfirmation = isAccountFetched && !account?.is_account_email_confirmed;
    const needsStripe = isAccountFetched && !!account?.requires_manual_verification;
    const canModify = isAccountFetched && !needsEmailConfirmation && !needsStripe;

    const editingTemplate = editing ? eventTemplate(editing) : undefined;
    // A new version starts from the organizer's, otherwise from the default one.
    const startingPoint = (type: EmailTemplateType): DefaultEmailTemplate | undefined => {
        const organizerVersion = organizerTemplate(type);
        return organizerVersion
            ? {subject: organizerVersion.subject, body: organizerVersion.body, cta: organizerVersion.cta}
            : defaultTemplatesQuery.data?.[type];
    };

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
            setEditing(null);
        };

        if (editingTemplate) {
            updateMutation.mutate({
                eventId,
                templateId: editingTemplate.id,
                templateData: data as UpdateEmailTemplateRequest,
            }, {onSuccess, onError});
        } else {
            createMutation.mutate({eventId, templateData: data as CreateEmailTemplateRequest}, {onSuccess, onError});
        }
    };

    const backToOrganizer = (template: EmailTemplate) => confirmationDialog(
        t`Go back to the organizer's version of this email? The event's version will be deleted.`,
        () => deleteMutation.mutate({eventId, templateId: template.id}, {
            onSuccess: () => showSuccess(t`Template deleted successfully`),
            onError: () => showError(t`Failed to delete template`),
        }),
        {confirm: t`Use the organizer's version`, cancel: t`Cancel`},
    );

    return (
        <SettingsCard
            id="email-templates"
            className={extra.anchored}
            title={t`Automatic emails`}
            subtitle={t`The organizer's version is sent, unless this event has its own.`}
        >
            {(needsStripe || needsEmailConfirmation) && (
                <div className={classes.banner}>
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

            {templatesQuery.isLoading && <Skeleton height={140} radius={18}/>}

            {!templatesQuery.isLoading && (
                <div className={classes.list}>
                    {EMAILS.map(email => {
                        const template = eventTemplate(email.type);
                        return (
                            <div key={email.type} className={`${classes.listRow} ${extra.emailRow}`}>
                                <span className={classes.pastille}>
                                    <img src={`/interface/admin/parametres/${email.icon}.svg`} alt=""/>
                                </span>
                                <div className={classes.listRowText}>
                                    <span className={classes.listRowTitle}>{email.title()}</span>
                                    <span className={classes.listRowHint}>{email.hint()}</span>
                                    <span className={extra.emailMeta}>
                                        {template
                                            ? (template.is_active ? <Tag tone="green">{t`Customized`}</Tag> : <Tag tone="neutral">{t`Inactive`}</Tag>)
                                            : <Tag tone="neutral">{t`Organizer's version`}</Tag>}
                                        {template && canModify && (
                                            <button type="button" className={classes.textButton} onClick={() => backToOrganizer(template)}
                                                    disabled={deleteMutation.isPending}>
                                                {t`Go back to the organizer's version`}
                                            </button>
                                        )}
                                    </span>
                                </div>
                                <Button
                                    variant="transparent"
                                    className={classes.outlineButton}
                                    leftSection={<img src="/interface/admin/parametres/crayon.svg" alt=""/>}
                                    onClick={() => setEditing(email.type)}
                                    disabled={!canModify}
                                >
                                    {t`Edit`}
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}

            <Link className={classes.textButton} to={`/manage/organizer/${organizerId}/emails`}>
                {t`The organizer's emails, with their preview`} →
            </Link>

            <Modal opened={editing !== null} onClose={() => setEditing(null)} size="xl" withCloseButton={false} padding="xl">
                {editing && (
                    <EmailTemplateEditor
                        key={`${editing}-${editingTemplate?.id ?? 'new'}`}
                        templateType={editing}
                        template={editingTemplate}
                        defaultTemplate={startingPoint(editing)}
                        onSave={handleSave}
                        onPreview={(data) => previewMutation.mutate({eventId, previewData: data})}
                        onClose={() => setEditing(null)}
                        isSaving={createMutation.isPending || updateMutation.isPending}
                        isPreviewLoading={previewMutation.isPending}
                        previewData={previewMutation.data}
                    />
                )}
            </Modal>
        </SettingsCard>
    );
};
