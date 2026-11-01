import {useState} from "react";
import {t} from "@lingui/macro";
import {AttendeeDetailsCollectionMethod, IdParam, OrganizerSettings} from "../../../../../types.ts";
import {useUpdateOrganizerSettings} from "../../../../../mutations/useUpdateOrganizerSettings.ts";
import {useSectionAutosave} from "../../../../layouts/AppLayout/PageStatus.tsx";
import {PillChoice, SettingsCard, ToggleRow} from "../SettingsUi.tsx";
import classes from "../Settings.module.scss";

type EventDefaults = Pick<OrganizerSettings,
    'default_attendee_details_collection_method' | 'default_show_marketing_opt_in' | 'default_allow_attendee_self_edit'>;

// « Valeurs par défaut des événements »: what a new event starts with (fees are in Paiements).
export const EventDefaultsCard = ({organizerId, settings}: { organizerId: IdParam, settings: OrganizerSettings }) => {
    const updateSettings = useUpdateOrganizerSettings();
    const [values, setValues] = useState<Required<EventDefaults>>({
        default_attendee_details_collection_method: settings.default_attendee_details_collection_method ?? 'PER_TICKET',
        default_show_marketing_opt_in: settings.default_show_marketing_opt_in ?? true,
        default_allow_attendee_self_edit: settings.default_allow_attendee_self_edit ?? false,
    });

    const queue = useSectionAutosave<EventDefaults>('event-defaults', (changes) => updateSettings.mutateAsync({
        organizerId,
        organizerSettings: changes,
    }));

    const change = (changes: EventDefaults) => {
        setValues(current => ({...current, ...changes}));
        queue(changes);
    };

    return (
        <SettingsCard title={t`Event Defaults`} subtitle={t`Applied to new events. Can be changed for each one.`}>
            <div className={classes.cardBody} style={{gap: '0.625rem'}}>
                <p className={classes.fieldLabel}>{t`Attendee details`}</p>
                <PillChoice<AttendeeDetailsCollectionMethod>
                    label={t`Attendee details`}
                    value={values.default_attendee_details_collection_method}
                    options={[
                        {value: 'PER_TICKET', label: t`For each ticket`},
                        {value: 'PER_ORDER', label: t`Per order`},
                    ]}
                    onChange={(value) => change({default_attendee_details_collection_method: value})}
                />
                <p className={classes.softHint}>
                    {values.default_attendee_details_collection_method === 'PER_TICKET'
                        ? t`Collect attendee details for each ticket purchased.`
                        : t`Use order details for all attendees. Attendee names and emails will match the buyer's information.`}
                </p>
            </div>
            <hr className={classes.separator}/>
            <ToggleRow
                label={t`Newsletter sign-up box`}
                hint={t`Shown at checkout.`}
                checked={values.default_show_marketing_opt_in}
                onChange={(checked) => change({default_show_marketing_opt_in: checked})}
            />
            <ToggleRow
                label={t`Self-service for attendees`}
                hint={t`They can update their ticket details with a secure link.`}
                checked={values.default_allow_attendee_self_edit}
                onChange={(checked) => change({default_allow_attendee_self_edit: checked})}
            />
        </SettingsCard>
    );
};
