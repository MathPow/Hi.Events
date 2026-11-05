import {useEffect, useState} from 'react';
import {Button, Divider, Group, Stack, Switch, Tabs, Text, TextInput,} from '@mantine/core';
import {useForm} from '@mantine/form';
import {IconBraces, IconEye} from '@tabler/icons-react';
import {t, Trans} from '@lingui/macro';
import {CreateEmailTemplateRequest, EmailTemplate, EmailTemplateType, UpdateEmailTemplateRequest, DefaultEmailTemplate} from '../../../types';
import {EmailTemplatePreviewPane} from './EmailTemplatePreviewPane';
import {CTAConfiguration} from './CTAConfiguration';
import classes from './EmailTemplateEditor.module.scss';
import {Editor} from "../Editor";
import {LiquidTokenControl} from '../Editor/Controls/LiquidTokenControl';
import {PopupHeader} from '../DehorsPopup';

interface EmailTemplateEditorProps {
    templateType: EmailTemplateType;
    template?: EmailTemplate;
    defaultTemplate?: DefaultEmailTemplate;
    onSave: (data: CreateEmailTemplateRequest | UpdateEmailTemplateRequest, form?: any) => void;
    onPreview: (data: { subject: string; body: string; template_type: EmailTemplateType; ctaLabel: string }) => void;
    onClose?: () => void;
    isSaving?: boolean;
    isPreviewLoading?: boolean;
    previewData?: { subject: string; body: string } | null;
}

export const EmailTemplateEditor = ({
                                        templateType,
                                        template,
                                        defaultTemplate,
                                        onSave,
                                        onPreview,
                                        onClose,
                                        isSaving = false,
                                        isPreviewLoading = false,
                                        previewData
                                    }: EmailTemplateEditorProps) => {
    const [activeTab, setActiveTab] = useState<string>('editor');

    const form = useForm({
        initialValues: {
            subject: template?.subject || defaultTemplate?.subject || '',
            body: template?.body || defaultTemplate?.body || '',
            ctaLabel: template?.cta?.label  || '',
            isActive: template?.is_active ?? true,
        },
        validate: {
            subject: (value) => (!value ? t`Subject is required` : null),
            body: (value) => (!value ? t`Body is required` : null),
            ctaLabel: (value) => (!value ? t`CTA label is required` : null),
        },
    });

    // Update form values when defaultTemplate is loaded (for new templates ONLY)
    useEffect(() => {
        if (!template && defaultTemplate && defaultTemplate.subject && defaultTemplate.body) {
            form.setFieldValue('subject', defaultTemplate.subject);
            form.setFieldValue('body', defaultTemplate.body);
            form.setFieldValue('ctaLabel', templateType === 'order_confirmation' ? t`View Order` : t`View Ticket`);
            form.setFieldValue('isActive', true);
        }
    }, [defaultTemplate, template]);

    // Manual preview trigger only when preview tab is active
    const triggerPreview = () => {
        if (form.values.subject && form.values.body) {
            onPreview({
                subject: form.values.subject,
                body: form.values.body,
                template_type: templateType,
                ctaLabel: form.values.ctaLabel || (templateType === 'order_confirmation' ? t`View Order` : t`View Ticket`),
            });
        }
    };

    // Trigger preview when switching to preview tab
    useEffect(() => {
        if (activeTab === 'preview' && form.values.subject && form.values.body) {
            triggerPreview();
        }
    }, [activeTab]);

    const handleSave = (values: typeof form.values) => {
        const templateData = {
            ...(template ? {} : {template_type: templateType}),
            subject: values.subject,
            body: values.body,
            ctaLabel: values.ctaLabel,
            isActive: values.isActive,
        };

        onSave(templateData as CreateEmailTemplateRequest | UpdateEmailTemplateRequest, form);
    };

    const templateTypeLabels: Record<EmailTemplateType, string> = {
        'order_confirmation': t`Order Confirmation`,
        'attendee_ticket': t`Attendee Ticket`,
    };

    return (
        <div className={classes.editor}>
            <form onSubmit={form.onSubmit(handleSave)}>
                <Stack gap="md">
                    <PopupHeader
                        title={template ? (
                            <Trans>Edit {templateTypeLabels[templateType]} Template</Trans>
                        ) : (
                            <Trans>Create {templateTypeLabels[templateType]} Template</Trans>
                        )}
                        onClose={() => onClose?.()}
                        status={(
                            <Text size="sm" c="dimmed">
                                <Trans>Change the text of this email. The automatic info is filled in when it is sent.</Trans>
                            </Text>
                        )}
                    />

                    <TextInput
                        label={<Trans>Subject</Trans>}
                        placeholder={t`Enter email subject...`}
                        required
                        {...form.getInputProps('subject')}
                    />

                    <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'editor')} variant="pills">
                        <Tabs.List>
                            <Tabs.Tab value="editor" leftSection={<IconBraces size={16}/>}>
                                <Trans>Editor</Trans>
                            </Tabs.Tab>
                            <Tabs.Tab value="preview" leftSection={<IconEye size={16}/>}>
                                <Trans>Preview</Trans>
                            </Tabs.Tab>
                        </Tabs.List>

                        <Tabs.Panel value="editor" pt="md">
                            <Stack gap="md">
                                <Editor
                                    value={form.values.body}
                                    onChange={(value: string) => form.setFieldValue('body', value)}
                                    error={form.errors.body}
                                    label={<Trans>Email Body</Trans>}
                                    description={t`Add automatic info (first name, event, date…) with the last button of the toolbar.`}
                                    editorType="full"
                                    allowTextStyling
                                    additionalToolbarControls={
                                        <LiquidTokenControl templateType={templateType} />
                                    }
                                />

                                <CTAConfiguration
                                    label={form.values.ctaLabel}
                                    onLabelChange={(label) => form.setFieldValue('ctaLabel', label)}
                                    error={form.errors.ctaLabel}
                                />
                            </Stack>
                        </Tabs.Panel>

                        <Tabs.Panel value="preview" pt="md">
                            <Stack gap="md">
                                <Group justify="flex-end">
                                    <Button
                                        size="xs"
                                        variant="light"
                                        onClick={triggerPreview}
                                        loading={isPreviewLoading}
                                        leftSection={<IconEye size={16}/>}
                                    >
                                        <Trans>Refresh Preview</Trans>
                                    </Button>
                                </Group>
                                <EmailTemplatePreviewPane
                                    subject={form.values.subject}
                                    previewData={previewData}
                                    isLoading={isPreviewLoading}
                                />
                            </Stack>
                        </Tabs.Panel>
                    </Tabs>

                    <Divider/>

                    <Switch
                        label={<Trans>Template Active</Trans>}
                        description={<Trans>Enable this template for sending emails</Trans>}
                        {...form.getInputProps('isActive', {type: 'checkbox'})}
                    />

                    <Button
                        type="submit"
                        fullWidth
                        loading={isSaving}
                    >
                        <Trans>Save Template</Trans>
                    </Button>
                </Stack>
            </form>
        </div>
    );
};
