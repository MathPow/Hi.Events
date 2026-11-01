import {t} from "@lingui/macro";
import {NumberInput} from "@mantine/core";
import {AttendeeDetailsCollectionMethod, EventSettings, IdParam} from "../../../../../types.ts";
import {useUpdateEventSettings} from "../../../../../mutations/useUpdateEventSettings.ts";
import {PillChoice, SettingsCard, ToggleRow} from "../../../organizer/Settings/SettingsUi.tsx";
import {useAutosaveForm} from "../useAutosaveForm.ts";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

interface Checkout {
    attendee_details_collection_method: AttendeeDetailsCollectionMethod;
    order_timeout_in_minutes: number | string;
    show_marketing_opt_in: boolean;
    allow_copy_details_to_all_attendees: boolean;
}

// « Caisse »: what buyers fill in and how long they have.
export const CheckoutCard = ({eventId, settings}: { eventId: IdParam, settings: EventSettings }) => {
    const updateSettings = useUpdateEventSettings();
    const {form, commit, choose} = useAutosaveForm<Checkout>({
        key: 'checkout',
        initialValues: {
            attendee_details_collection_method: settings.attendee_details_collection_method ?? 'PER_TICKET',
            order_timeout_in_minutes: settings.order_timeout_in_minutes ?? 15,
            show_marketing_opt_in: settings.show_marketing_opt_in ?? true,
            allow_copy_details_to_all_attendees: settings.allow_copy_details_to_all_attendees ?? true,
        },
        save: (changes) => updateSettings.mutateAsync({eventId, eventSettings: changes as Partial<EventSettings>}),
    });

    const perOrder = form.values.attendee_details_collection_method === 'PER_ORDER';

    return (
        <SettingsCard
            id="homepage-settings"
            className={extra.anchored}
            title={t({message: 'Checkout', context: 'checkout page title'})}
            subtitle={t`What buyers fill in, and how long they have.`}
        >
            <div className={extra.fieldGroup}>
                <p className={classes.fieldLabel}>{t`Attendee information collection`}</p>
                <PillChoice
                    label={t`Attendee information collection`}
                    value={form.values.attendee_details_collection_method}
                    options={[
                        {value: 'PER_TICKET', label: t`Per ticket`},
                        {value: 'PER_ORDER', label: t`Per order`},
                    ]}
                    onChange={(value) => choose('attendee_details_collection_method', value)}
                />
                <p className={classes.hint}>
                    {perOrder
                        ? t`Use order details for all attendees. Attendee names and emails will match the buyer's information.`
                        : t`Collect attendee details for each ticket purchased.`}
                </p>
            </div>

            <NumberInput
                className={classes.field}
                label={t`Order timeout`}
                description={t`How many minutes the customer has to complete their order. We recommend at least 15 minutes`}
                min={1}
                max={120}
                allowDecimal={false}
                allowNegative={false}
                suffix={` ${t`minutes`}`}
                {...form.getInputProps('order_timeout_in_minutes')}
                onBlur={() => commit('order_timeout_in_minutes')}
            />

            <ToggleRow
                label={t`Show marketing opt-in checkbox`}
                hint={t`Display a checkbox allowing customers to opt-in to receive marketing communications from this event organizer.`}
                checked={form.values.show_marketing_opt_in}
                onChange={(checked) => choose('show_marketing_opt_in', checked)}
            />
            {!perOrder && (
                <ToggleRow
                    label={t`Allow buyers to copy their details to all attendees`}
                    hint={t`Otherwise, buyers can copy them to the first attendee only.`}
                    checked={form.values.allow_copy_details_to_all_attendees}
                    onChange={(checked) => choose('allow_copy_details_to_all_attendees', checked)}
                />
            )}
        </SettingsCard>
    );
};
