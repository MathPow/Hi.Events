import {t} from "@lingui/macro";
import {EventSettings, IdParam} from "../../../../../types.ts";
import {useUpdateEventSettings} from "../../../../../mutations/useUpdateEventSettings.ts";
import {Editor} from "../../../../common/Editor";
import {SettingsCard} from "../../../organizer/Settings/SettingsUi.tsx";
import {htmlOrNull, useAutosaveForm} from "../useAutosaveForm.ts";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

// « Dépôts de garantie »: what to do with the deposit set on a product (sent separately).
export const DepositsCard = ({eventId, settings}: { eventId: IdParam, settings: EventSettings }) => {
    const updateSettings = useUpdateEventSettings();
    const {form, commit} = useAutosaveForm<{ deposit_instructions: string }>({
        key: 'deposits',
        initialValues: {deposit_instructions: settings.deposit_instructions ?? ''},
        html: ['deposit_instructions'],
        save: (changes) => updateSettings.mutateAsync({
            eventId,
            eventSettings: {deposit_instructions: htmlOrNull(changes.deposit_instructions)},
        }),
    });

    return (
        <SettingsCard
            id="deposit-settings"
            className={extra.anchored}
            title={t`Security Deposits`}
            subtitle={t`Set a deposit amount on a product to ask for a security deposit. Participants send it separately; it is not included in the order total. Track, return or retain deposits from the Deposits page.`}
        >
            <Editor
                className={`${classes.description} ${extra.editor}`}
                editorType="simple"
                label={t`Deposit Instructions`}
                description={t`Shown with the deposit amount on the order page and confirmation email (e.g., where to send the Interac e-Transfer).`}
                value={form.values.deposit_instructions}
                error={form.errors.deposit_instructions as string | undefined}
                onChange={(value) => form.setFieldValue('deposit_instructions', value)}
                onBlur={() => commit('deposit_instructions')}
            />
        </SettingsCard>
    );
};
