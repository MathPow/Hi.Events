import {t} from "@lingui/macro";
import {Select} from "@mantine/core";
import {EventSettings, IdParam} from "../../../../../types.ts";
import {useUpdateEventSettings} from "../../../../../mutations/useUpdateEventSettings.ts";
import {SettingsCard, ToggleRow} from "../../../organizer/Settings/SettingsUi.tsx";
import {useAutosaveForm} from "../useAutosaveForm.ts";
import {durationIcon, FIELD_CHEVRON, HINT_UNDER_FIELD} from "../fieldParts.tsx";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

interface TicketTransfer {
    allow_ticket_transfer: boolean;
    ticket_transfer_cutoff_hours: number;
}

const DEFAULT_CUTOFF_HOURS = 48;

// « Transfert de billet »: participants give their ticket to someone else themselves, until a cutoff.
export const TicketTransferCard = ({eventId, settings}: { eventId: IdParam, settings: EventSettings }) => {
    const updateSettings = useUpdateEventSettings();
    const {form, choose} = useAutosaveForm<TicketTransfer>({
        key: 'ticket-transfer',
        initialValues: {
            allow_ticket_transfer: !!settings.allow_ticket_transfer,
            ticket_transfer_cutoff_hours: settings.ticket_transfer_cutoff_hours ?? DEFAULT_CUTOFF_HOURS,
        },
        save: (changes) => updateSettings.mutateAsync({
            eventId,
            eventSettings: changes as Partial<EventSettings>,
        }),
    });

    const cutoffs = [
        {value: '24', label: t`24 hours`},
        {value: '48', label: t`48 hours`},
        {value: '168', label: t`7 days`},
    ];

    return (
        <SettingsCard
            id="ticket-transfer-settings"
            className={extra.anchored}
            title={t`Ticket transfer`}
            subtitle={t`A participant who can't make it gives their spot to someone else, without writing to you.`}
        >
            <ToggleRow
                label={t`Participants can transfer their ticket`}
                hint={t`From their ticket. The new participant receives a new ticket by email, signs the documents themselves, and the old ticket stops working.`}
                checked={form.values.allow_ticket_transfer}
                onChange={(checked) => choose('allow_ticket_transfer', checked)}
            />
            {form.values.allow_ticket_transfer && (
                <Select
                    className={classes.field}
                    label={t`Until … before the start`}
                    description={t`After that, the ticket can no longer be transferred.`}
                    allowDeselect={false}
                    data={cutoffs}
                    leftSection={durationIcon()}
                    leftSectionWidth={48}
                    {...FIELD_CHEVRON}
                    {...HINT_UNDER_FIELD}
                    value={String(form.values.ticket_transfer_cutoff_hours)}
                    error={form.errors.ticket_transfer_cutoff_hours}
                    onChange={(value) => value && choose('ticket_transfer_cutoff_hours', Number(value))}
                />
            )}
        </SettingsCard>
    );
};
