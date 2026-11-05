import {Button, Group, Stack, Text, TextInput} from "@mantine/core";
import {useForm} from "@mantine/form";
import {t} from "@lingui/macro";
import {EmailCustomizationType, EmailTemplate, IdParam} from "../../../../types.ts";
import {useSaveEmailCustomization} from "../../../../mutations/useSaveEmailCustomization.ts";
import {showError, showSuccess} from "../../../../utilites/notifications.tsx";
import {Editor} from "../../../common/Editor";
import {LiquidTokenControl} from "../../../common/Editor/Controls/LiquidTokenControl.tsx";
import {showServerErrors} from "../Settings/SettingsUi.tsx";
import {PopupHeader} from "../../../common/DehorsPopup";

interface EmailMessageEditorProps {
    organizerId: IdParam;
    type: EmailCustomizationType;
    title: string;
    template?: EmailTemplate;
    defaultSubject?: string;
    onClose: () => void;
}

/**
 * The emails that keep their content (amounts, links, dates): the organizer changes the subject and
 * adds a message, shown at the top in a box signed with their name. Both empty: the default email.
 */
export const EmailMessageEditor = ({organizerId, type, title, template, defaultSubject, onClose}: EmailMessageEditorProps) => {
    const saveMutation = useSaveEmailCustomization();
    const form = useForm({
        initialValues: {
            subject: template?.subject ?? '',
            message: template?.body ?? '',
        },
    });

    const save = (values: typeof form.values) => saveMutation.mutate({
        organizerId,
        templateType: type,
        subject: values.subject,
        message: values.message,
    }, {
        onSuccess: () => {
            showSuccess(t`Email saved`);
            onClose();
        },
        onError: (error: any) => {
            showServerErrors(form, error);
            showError(t`The email could not be saved. Please try again.`);
        },
    });

    return (
        <form onSubmit={form.onSubmit(save)}>
            <Stack gap="md">
                <PopupHeader
                    title={title}
                    onClose={onClose}
                    status={(
                        <Text size="sm" c="dimmed">
                            {t`The email keeps its usual content, with the right amounts, dates and links. You can change its subject and add a message, shown at the top with your name.`}
                        </Text>
                    )}
                />

                <TextInput
                    label={t({message: 'Subject', context: 'email'})}
                    description={t`Leave empty to keep the usual subject.`}
                    placeholder={defaultSubject}
                    maxLength={255}
                    {...form.getInputProps('subject')}
                />

                <Editor
                    value={form.values.message}
                    onChange={(value: string) => form.setFieldValue('message', value)}
                    error={form.errors.message as string | undefined}
                    label={t`Your message`}
                    description={t`Optional. Add automatic info (first name, event, date…) with the last button of the toolbar.`}
                    editorType="simple"
                    additionalToolbarControls={<LiquidTokenControl templateType={type}/>}
                />

                <Group justify="flex-end" gap="sm">
                    <Button variant="default" onClick={onClose}>
                        {t`Cancel`}
                    </Button>
                    <Button type="submit" loading={saveMutation.isPending}>
                        {t`Save`}
                    </Button>
                </Group>
            </Stack>
        </form>
    );
};
