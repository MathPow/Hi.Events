import {t} from "@lingui/macro";
import {NumberInput} from "@mantine/core";
import {EventSettings, IdParam} from "../../../../../types.ts";
import {useUpdateEventSettings} from "../../../../../mutations/useUpdateEventSettings.ts";
import {SettingsCard, ToggleRow} from "../../../organizer/Settings/SettingsUi.tsx";
import {useAutosaveForm} from "../useAutosaveForm.ts";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

interface Waitlist {
    waitlist_auto_process: boolean;
    waitlist_offer_timeout_minutes: number | string;
}

// « Liste d'attente »: when a product sells out, buyers can join it and get an offer when spots free up.
export const WaitlistCard = ({eventId, settings}: { eventId: IdParam, settings: EventSettings }) => {
    const updateSettings = useUpdateEventSettings();
    const {form, commit, choose} = useAutosaveForm<Waitlist>({
        key: 'waitlist',
        initialValues: {
            waitlist_auto_process: !!settings.waitlist_auto_process,
            waitlist_offer_timeout_minutes: settings.waitlist_offer_timeout_minutes ?? '',
        },
        save: (changes) => updateSettings.mutateAsync({
            eventId,
            eventSettings: {
                ...changes,
                ...('waitlist_offer_timeout_minutes' in changes && {
                    waitlist_offer_timeout_minutes: changes.waitlist_offer_timeout_minutes === ''
                        ? null
                        : Number(changes.waitlist_offer_timeout_minutes),
                }),
            } as Partial<EventSettings>,
        }),
    });

    return (
        <SettingsCard
            id="waitlist-settings"
            className={extra.anchored}
            title={t`Waitlist`}
            subtitle={t`When a product sells out, buyers can join a waitlist and get an offer when spots free up.`}
        >
            <ToggleRow
                label={t`Auto-Process Waitlist`}
                hint={t`Automatically offer tickets to the next person when capacity becomes available. If disabled, you can manually process the waitlist from the Waitlist page.`}
                checked={form.values.waitlist_auto_process}
                onChange={(checked) => choose('waitlist_auto_process', checked)}
            />
            <NumberInput
                className={classes.field}
                label={t`Offer Timeout`}
                description={t`How long a customer has to complete their purchase after receiving an offer. Leave empty for no timeout.`}
                placeholder={t`e.g. 180 (3 hours)`}
                min={1}
                max={10080}
                allowDecimal={false}
                allowNegative={false}
                suffix={` ${t`minutes`}`}
                {...form.getInputProps('waitlist_offer_timeout_minutes')}
                onBlur={() => commit('waitlist_offer_timeout_minutes')}
            />
        </SettingsCard>
    );
};
