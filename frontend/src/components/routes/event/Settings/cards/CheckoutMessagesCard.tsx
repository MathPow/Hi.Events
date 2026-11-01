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

// « Messages de la caisse »: before the payment, and after it on the order summary.
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

    const editor = (field: keyof Messages, label: string, description: string) => (
        <Editor
            className={`${classes.description} ${extra.editor}`}
            label={label}
            description={description}
            value={form.values[field]}
            error={form.errors[field] as string | undefined}
            onChange={(value) => form.setFieldValue(field, value)}
            onBlur={() => commit(field)}
        />
    );

    return (
        <SettingsCard
            full
            title={t`Checkout messages`}
            subtitle={t`A word for your buyers, before and after they pay.`}
        >
            <div className={extra.columns}>
                {editor('pre_checkout_message', t`Pre Checkout message`, t`Shown to the customer before they checkout`)}
                {editor(
                    'post_checkout_message',
                    t`Post Checkout message`,
                    t`Shown on the order summary, once the order is paid.`,
                )}
            </div>
        </SettingsCard>
    );
};
