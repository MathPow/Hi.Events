import {t} from "@lingui/macro";
import {IdParam, OrganizerSettings} from "../../../../types.ts";
import {useUpdateOrganizerSettings} from "../../../../mutations/useUpdateOrganizerSettings.ts";
import {useAutosaveStatus} from "../../../layouts/AppLayout/PageStatus.tsx";
import {Editor} from "../../../common/Editor";
import {SettingsCard} from "../Settings/SettingsUi.tsx";
import {htmlOrNull, useAutosaveForm} from "../../event/Settings/useAutosaveForm.ts";
import settingsClasses from "../Settings/Settings.module.scss";
import eventSettings from "../../event/Settings/EventSettings.module.scss";

/**
 * « Pied de page des courriels »: added at the bottom of every email of every event of the organizer
 * (it used to be set event by event). Saved when the editor is left.
 */
export const EmailFooterCard = ({organizerId, settings}: { organizerId: IdParam, settings: OrganizerSettings }) => {
    const updateSettings = useUpdateOrganizerSettings();
    useAutosaveStatus();
    const {form, commit} = useAutosaveForm<{ email_footer_message: string }>({
        key: 'email-footer',
        initialValues: {email_footer_message: settings.email_footer_message ?? ''},
        html: ['email_footer_message'],
        save: (changes) => updateSettings.mutateAsync({
            organizerId,
            organizerSettings: {email_footer_message: htmlOrNull(changes.email_footer_message) as string | null},
        }),
    });

    return (
        <SettingsCard id="email-footer" title={t`Email footer`}
                      subtitle={t`Added at the bottom of every email of all your events.`}>
            <Editor
                className={`${settingsClasses.description} ${eventSettings.editor} ${eventSettings.editorSmall}`}
                editorType="simple"
                allowTextStyling
                value={form.values.email_footer_message}
                error={form.errors.email_footer_message as string | undefined}
                onChange={(value) => form.setFieldValue('email_footer_message', value)}
                onBlur={() => commit('email_footer_message')}
            />
        </SettingsCard>
    );
};
