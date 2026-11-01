import {t} from "@lingui/macro";
import {TextInput} from "@mantine/core";
import {EventSettings, IdParam} from "../../../../../types.ts";
import {useUpdateEventSettings} from "../../../../../mutations/useUpdateEventSettings.ts";
import {Editor} from "../../../../common/Editor";
import {SettingsCard, ToggleRow} from "../../../organizer/Settings/SettingsUi.tsx";
import {htmlOrNull, useAutosaveForm} from "../useAutosaveForm.ts";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

interface EmailSettings {
    support_email: string;
    email_footer_message: string;
    notify_organizer_of_new_orders: boolean;
}

// « Réponses et notifications »: where buyers' replies go, the footer of the event's emails, and the
// organizer's email for each new order.
export const EmailSettingsCard = ({eventId, settings}: { eventId: IdParam, settings: EventSettings }) => {
    const updateSettings = useUpdateEventSettings();
    const {form, commit, choose} = useAutosaveForm<EmailSettings>({
        key: 'email-settings',
        initialValues: {
            support_email: settings.support_email ?? '',
            email_footer_message: settings.email_footer_message ?? '',
            notify_organizer_of_new_orders: settings.notify_organizer_of_new_orders ?? true,
        },
        html: ['email_footer_message'],
        save: (changes) => updateSettings.mutateAsync({
            eventId,
            eventSettings: {
                ...changes,
                ...('support_email' in changes && {support_email: (changes.support_email?.trim() || null) as string}),
                ...('email_footer_message' in changes && {email_footer_message: htmlOrNull(changes.email_footer_message) as string}),
            },
        }),
    });

    return (
        <SettingsCard
            id="email-settings"
            className={extra.anchored}
            title={t`Replies and notifications`}
            subtitle={t`For all the emails of this event.`}
        >
            <TextInput
                className={classes.field}
                type="email"
                label={t`Contact email`}
                description={t`Buyers' replies and questions arrive at this address.`}
                {...form.getInputProps('support_email')}
                onBlur={() => commit('support_email')}
            />
            <Editor
                className={`${classes.description} ${extra.editor} ${extra.editorSmall}`}
                editorType="simple"
                allowTextStyling
                label={t`Email footer`}
                description={t`Added at the bottom of every email of this event.`}
                value={form.values.email_footer_message}
                error={form.errors.email_footer_message as string | undefined}
                onChange={(value) => form.setFieldValue('email_footer_message', value)}
                onBlur={() => commit('email_footer_message')}
            />
            <ToggleRow
                label={t`Notify me of new orders`}
                hint={t`An email to the organizer for each new order.`}
                checked={form.values.notify_organizer_of_new_orders}
                onChange={(checked) => choose('notify_organizer_of_new_orders', checked)}
            />
        </SettingsCard>
    );
};
