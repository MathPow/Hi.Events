import {t} from "@lingui/macro";
import {EventSettings, IdParam} from "../../../../../types.ts";
import {useUpdateEventSettings} from "../../../../../mutations/useUpdateEventSettings.ts";
import {Editor} from "../../../../common/Editor";
import {SettingsCard} from "../../../organizer/Settings/SettingsUi.tsx";
import {htmlOrNull, useAutosaveForm} from "../useAutosaveForm.ts";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

// « Décharge de responsabilité »: with a text, every ticket's attendee accepts it at checkout and signs
// with their full name, a parent or guardian for a minor.
export const WaiverCard = ({eventId, settings}: { eventId: IdParam, settings: EventSettings }) => {
    const updateSettings = useUpdateEventSettings();
    const {form, commit} = useAutosaveForm<{ waiver_text: string }>({
        key: 'waiver',
        initialValues: {waiver_text: settings.waiver_text ?? ''},
        html: ['waiver_text'],
        save: (changes) => updateSettings.mutateAsync({
            eventId,
            eventSettings: {waiver_text: htmlOrNull(changes.waiver_text)},
        }),
    });

    return (
        <SettingsCard
            id="waiver-settings"
            className={extra.anchored}
            title={t`Liability waiver`}
            subtitle={t`Each attendee accepts it at checkout and signs with their full name. For a participant under 18 on the event day, a parent or guardian signs too: add the participant form to ask for the date of birth. Leave empty for no waiver.`}
        >
            <Editor
                className={`${classes.description} ${extra.editor}`}
                label={t`Waiver text`}
                value={form.values.waiver_text}
                error={form.errors.waiver_text as string | undefined}
                onChange={(value) => form.setFieldValue('waiver_text', value)}
                onBlur={() => commit('waiver_text')}
            />
            <p className={classes.softHint}>{t`Signatures already collected keep the text as it read when they were signed.`}</p>
        </SettingsCard>
    );
};
