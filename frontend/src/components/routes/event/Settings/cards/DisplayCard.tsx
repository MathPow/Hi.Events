import {t} from "@lingui/macro";
import {EventSettings, IdParam} from "../../../../../types.ts";
import {useUpdateEventSettings} from "../../../../../mutations/useUpdateEventSettings.ts";
import {SettingsCard, ToggleRow} from "../../../organizer/Settings/SettingsUi.tsx";
import {useAutosaveForm} from "../useAutosaveForm.ts";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

type PriceDisplayMode = 'INCLUSIVE' | 'EXCLUSIVE';

interface Display {
    price_display_mode: PriceDisplayMode;
    allow_attendee_self_edit: boolean;
}

// « Affichage et options »: how prices show and the attendees' self-service, on one column.
export const DisplayCard = ({eventId, settings}: { eventId: IdParam, settings: EventSettings }) => {
    const updateSettings = useUpdateEventSettings();
    const {form, choose} = useAutosaveForm<Display>({
        key: 'display',
        initialValues: {
            price_display_mode: settings.price_display_mode ?? 'EXCLUSIVE',
            allow_attendee_self_edit: !!settings.allow_attendee_self_edit,
        },
        save: (changes) => updateSettings.mutateAsync({eventId, eventSettings: changes}),
    });

    const priceOptions: { value: PriceDisplayMode, title: string, text: string }[] = [
        {
            value: 'INCLUSIVE',
            title: t`Taxes and fees included`,
            text: t`The price shown is the final price paid.`,
        },
        {
            value: 'EXCLUSIVE',
            title: t`Taxes and fees separate`,
            text: t`The price shown is before taxes; taxes and fees are added at payment.`,
        },
    ];

    return (
        <SettingsCard
            id="misc-settings"
            full
            className={extra.anchored}
            title={t`Display and options`}
            subtitle={t`How prices show and what attendees can change themselves.`}
        >
            <div className={extra.fieldGroup}>
                <p className={classes.fieldLabel}>{t`Prices shown`}</p>
                <div className={extra.radioStack} role="radiogroup" aria-label={t`Prices shown`}>
                    {priceOptions.map(option => (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={form.values.price_display_mode === option.value}
                            className={classes.feeOption}
                            onClick={() => choose('price_display_mode', option.value)}
                        >
                            <span className={classes.radio}/>
                            <span className={classes.feeOptionBody}>
                                <span className={classes.feeOptionTitle}>{option.title}</span>
                                <span className={classes.feeOptionText}>{option.text}</span>
                            </span>
                        </button>
                    ))}
                </div>
                {form.errors.price_display_mode && <p className={classes.hint} role="alert">{form.errors.price_display_mode}</p>}
            </div>

            <ToggleRow
                label={t`Attendee self-service`}
                hint={t`They can correct their name and email with the link in their confirmation.`}
                checked={form.values.allow_attendee_self_edit}
                onChange={(checked) => choose('allow_attendee_self_edit', checked)}
            />
        </SettingsCard>
    );
};
