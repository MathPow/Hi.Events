import {t} from "@lingui/macro";
import {EventSettings, IdParam} from "../../../../../types.ts";
import {useUpdateEventSettings} from "../../../../../mutations/useUpdateEventSettings.ts";
import {Editor} from "../../../../common/Editor";
import {SettingsCard} from "../../../organizer/Settings/SettingsUi.tsx";
import {htmlOrNull, useAutosaveForm} from "../useAutosaveForm.ts";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

interface Messages {
    pre_checkout_message: string;
    post_checkout_message: string;
}

// « Messages aux acheteurs »: before the payment, and after it on the order summary.
export const CheckoutMessagesCard = ({eventId, settings}: { eventId: IdParam, settings: EventSettings }) => {
    const updateSettings = useUpdateEventSettings();
    const {form, commit} = useAutosaveForm<Messages>({
        key: 'checkout-messages',
        initialValues: {
            pre_checkout_message: settings.pre_checkout_message ?? '',
            post_checkout_message: settings.post_checkout_message ?? '',
        },
        html: ['pre_checkout_message', 'post_checkout_message'],
        save: (changes) => updateSettings.mutateAsync({
            eventId,
            eventSettings: Object.fromEntries(Object.entries(changes).map(([field, value]) => [field, htmlOrNull(value as string)])),
        }),
    });

    const editor = (field: keyof Messages, label: string, hint: string) => (
        <div className={extra.fieldGroup}>
            <Editor
                className={`${classes.description} ${extra.plainEditor}`}
                editorType="plain"
                label={label}
                value={form.values[field]}
                error={form.errors[field] as string | undefined}
                onChange={(value) => form.setFieldValue(field, value)}
                onBlur={() => commit(field)}
            />
            <p className={classes.hint}>{hint}</p>
        </div>
    );

    return (
        <SettingsCard
            full
            title={t`Messages to buyers`}
            subtitle={t`A word before and after payment.`}
        >
            <div className={extra.columns}>
                {editor('pre_checkout_message', t`Before payment`, t`Shown right before paying.`)}
                {editor('post_checkout_message', t`After payment`, t`Shown on the order confirmation.`)}
            </div>
        </SettingsCard>
    );
};
