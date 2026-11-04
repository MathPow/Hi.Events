import {t} from "@lingui/macro";
import {Select} from "@mantine/core";
import {AttendeeDetailsCollectionMethod, EventSettings, IdParam} from "../../../../../types.ts";
import {useUpdateEventSettings} from "../../../../../mutations/useUpdateEventSettings.ts";
import {PillChoice, SettingsCard, ToggleRow} from "../../../organizer/Settings/SettingsUi.tsx";
import {useAutosaveForm} from "../useAutosaveForm.ts";
import {durationIcon, FIELD_CHEVRON, HINT_UNDER_FIELD, withCurrentOption} from "../fieldParts.tsx";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

interface Checkout {
    attendee_details_collection_method: AttendeeDetailsCollectionMethod;
    order_timeout_in_minutes: number | string;
    show_marketing_opt_in: boolean;
    allow_copy_details_to_all_attendees: boolean;
}

const MINUTES = [5, 10, 15, 20, 30, 45, 60, 90, 120];

// « Au paiement »: what buyers fill in and how long they have.
export const CheckoutCard = ({eventId, settings}: { eventId: IdParam, settings: EventSettings }) => {
    const updateSettings = useUpdateEventSettings();
    const {form, choose} = useAutosaveForm<Checkout>({
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
    const minutesLabel = (minutes: number) => `${minutes} ${t`minutes`}`;

    return (
        <SettingsCard
            id="homepage-settings"
            full
            className={extra.anchored}
            title={t`At payment`}
            subtitle={t`What buyers fill in and how long they have to pay.`}
        >
            <div className={extra.fieldGroup}>
                <p className={classes.fieldLabel}>{t`Attendee information`}</p>
                <PillChoice
                    label={t`Attendee information`}
                    value={form.values.attendee_details_collection_method}
                    options={[
                        {value: 'PER_TICKET', label: t`For each ticket`},
                        {value: 'PER_ORDER', label: t`Once per order`},
                    ]}
                    onChange={(value) => choose('attendee_details_collection_method', value)}
                />
                <p className={classes.hint}>
                    {perOrder
                        ? t`Once per order: the buyer's name and email are used for every ticket.`
                        : t`For each ticket: we ask for each attendee's name and email.`}
                </p>
            </div>

            <Select
                className={`${classes.field} ${extra.narrowField}`}
                label={t`Time to pay`}
                description={t`Tickets are held during this time. 15 minutes or more is ideal.`}
                allowDeselect={false}
                data={withCurrentOption(
                    MINUTES.map(minutes => ({value: String(minutes), label: minutesLabel(minutes)})),
                    form.values.order_timeout_in_minutes,
                    minutesLabel,
                )}
                leftSection={durationIcon()}
                leftSectionWidth={48}
                {...FIELD_CHEVRON}
                {...HINT_UNDER_FIELD}
                value={String(form.values.order_timeout_in_minutes)}
                error={form.errors.order_timeout_in_minutes}
                onChange={(value) => value && choose('order_timeout_in_minutes', Number(value))}
            />

            <ToggleRow
                label={t`Newsletter checkbox`}
                hint={t`A checkbox at payment to receive the organizer's news.`}
                checked={form.values.show_marketing_opt_in}
                onChange={(checked) => choose('show_marketing_opt_in', checked)}
            />
            {!perOrder && (
                <ToggleRow
                    label={t`Copy the buyer's details`}
                    hint={t`A button to fill in all the attendees with the buyer's details.`}
                    checked={form.values.allow_copy_details_to_all_attendees}
                    onChange={(checked) => choose('allow_copy_details_to_all_attendees', checked)}
                />
            )}
        </SettingsCard>
    );
};
