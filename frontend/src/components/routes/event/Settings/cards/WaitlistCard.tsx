import {t} from "@lingui/macro";
import {Select} from "@mantine/core";
import {EventSettings, IdParam} from "../../../../../types.ts";
import {useUpdateEventSettings} from "../../../../../mutations/useUpdateEventSettings.ts";
import {SettingsCard, ToggleRow} from "../../../organizer/Settings/SettingsUi.tsx";
import {useAutosaveForm} from "../useAutosaveForm.ts";
import {durationIcon, FIELD_CHEVRON, HINT_UNDER_FIELD, withCurrentOption} from "../fieldParts.tsx";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

interface Waitlist {
    waitlist_auto_process: boolean;
    waitlist_offer_timeout_minutes: number | string;
}

const HOURS = [1, 2, 3, 6, 12, 24, 48, 72, 168];
const NO_LIMIT = 'none';

const durationLabel = (minutes: number) => {
    if (minutes % 60 !== 0) {
        return `${minutes} ${t`minutes`}`;
    }
    const hours = minutes / 60;
    return hours === 1 ? t`1 hour` : t`${hours} hours`;
};

// « Liste d'attente »: when it's full, people join it and get an offer when a spot opens up.
export const WaitlistCard = ({eventId, settings}: { eventId: IdParam, settings: EventSettings }) => {
    const updateSettings = useUpdateEventSettings();
    const {form, choose} = useAutosaveForm<Waitlist>({
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

    const timeout = form.values.waitlist_offer_timeout_minutes;

    return (
        <SettingsCard
            id="waitlist-settings"
            className={extra.anchored}
            title={t`Waitlist`}
            subtitle={t`When it's full, people sign up and get an offer if a spot opens up.`}
        >
            <ToggleRow
                label={t`Offer spots automatically`}
                hint={t`The next person gets the offer as soon as a spot opens up. Otherwise, you choose in Waitlist.`}
                checked={form.values.waitlist_auto_process}
                onChange={(checked) => choose('waitlist_auto_process', checked)}
            />
            <Select
                className={classes.field}
                label={t`Time to accept the offer`}
                description={t`Empty = no limit.`}
                allowDeselect={false}
                data={[
                    {value: NO_LIMIT, label: t`No limit`},
                    ...withCurrentOption(
                        HOURS.map(hours => ({value: String(hours * 60), label: durationLabel(hours * 60)})),
                        timeout,
                        durationLabel,
                    ),
                ]}
                leftSection={durationIcon()}
                leftSectionWidth={48}
                {...FIELD_CHEVRON}
                {...HINT_UNDER_FIELD}
                value={timeout === '' ? NO_LIMIT : String(timeout)}
                error={form.errors.waitlist_offer_timeout_minutes}
                onChange={(value) => value && choose('waitlist_offer_timeout_minutes', value === NO_LIMIT ? '' : value)}
            />
        </SettingsCard>
    );
};
