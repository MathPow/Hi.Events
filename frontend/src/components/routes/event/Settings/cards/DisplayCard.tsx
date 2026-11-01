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
    hide_getting_started_page: boolean;
    allow_attendee_self_edit: boolean;
}

// « Affichage et options »: how prices show, the « Commencer » page and the attendees' self-service.
export const DisplayCard = ({eventId, settings}: { eventId: IdParam, settings: EventSettings }) => {
    const updateSettings = useUpdateEventSettings();
    const {form, choose} = useAutosaveForm<Display>({
        key: 'display',
        initialValues: {
            price_display_mode: settings.price_display_mode ?? 'EXCLUSIVE',
            hide_getting_started_page: !!settings.hide_getting_started_page,
            allow_attendee_self_edit: !!settings.allow_attendee_self_edit,
        },
        save: (changes) => updateSettings.mutateAsync({eventId, eventSettings: changes}),
    });

    const priceOptions: { value: PriceDisplayMode, title: string, text: string }[] = [
        {
            value: 'INCLUSIVE',
            title: t`Include tax and fees in the price`,
            text: t`The price displayed to the customer will include taxes and fees.`,
        },
        {
            value: 'EXCLUSIVE',
            title: t`Show tax and fees separately`,
            text: t`The price displayed to the customer will not include taxes and fees. They will be shown separately`,
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
                <p className={classes.fieldLabel}>{t`Price display mode`}</p>
                <div className={extra.radioCards} role="radiogroup" aria-label={t`Price display mode`}>
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

            <hr className={classes.separator}/>

            <ToggleRow
                label={t`Enable attendee self-service`}
                hint={t`Allow attendees to update their ticket information (name, email) via a secure link sent with their order confirmation.`}
                checked={form.values.allow_attendee_self_edit}
                onChange={(checked) => choose('allow_attendee_self_edit', checked)}
            />
            <ToggleRow
                label={t`Hide getting started page`}
                hint={t`Hide the getting started page from the sidebar`}
                checked={form.values.hide_getting_started_page}
                onChange={(checked) => choose('hide_getting_started_page', checked)}
            />
        </SettingsCard>
    );
};
