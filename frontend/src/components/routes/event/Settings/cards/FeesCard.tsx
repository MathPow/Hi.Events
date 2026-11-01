import {useState} from "react";
import {Link} from "react-router";
import {t} from "@lingui/macro";
import {Account, Event, EventSettings, IdParam} from "../../../../../types.ts";
import {useUpdateEventSettings} from "../../../../../mutations/useUpdateEventSettings.ts";
import {useGetPlatformFeePreview} from "../../../../../queries/useGetPlatformFeePreview.ts";
import {useSectionAutosave} from "../../../../layouts/AppLayout/PageStatus.tsx";
import {
    FeeChoice,
    FeeChoiceGroup,
    feesSubtitle,
    feeText,
    Rates,
    SAMPLE_PRICE,
} from "../../../organizer/Settings/payments/FeesCard.tsx";
import {SettingsCard} from "../../../organizer/Settings/SettingsUi.tsx";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

interface FeesCardProps {
    eventId: IdParam;
    event: Event;
    settings: EventSettings;
    account: Account;
}

/**
 * « Frais de la billetterie » of this event, like the organizer's default: one choice for the platform
 * fee and Stripe's processing fee, passed on to the buyer or absorbed, with an example in the event's
 * currency.
 */
export const FeesCard = ({eventId, event, settings, account}: FeesCardProps) => {
    const updateSettings = useUpdateEventSettings();
    // The fixed fee converted to the event's currency, and Stripe's rates.
    const {data: preview} = useGetPlatformFeePreview(eventId, SAMPLE_PRICE);
    const configuration = account.configuration;
    const currency = event.currency || account.currency_code || 'CAD';

    // Platform fees only exist in Saas mode, and some plans have none.
    const hasPlatformFee = !!account.is_saas_mode_enabled && !!configuration && !configuration.bypass_application_fees
        && (Number(configuration.application_fees?.percentage) > 0 || Number(configuration.application_fees?.fixed) > 0);
    const stripePercentage = Number(preview?.stripe_fee_percentage ?? account.stripe_processing_fees?.percentage ?? 0);
    const rates: Rates = {
        platformRate: hasPlatformFee ? Number(configuration?.application_fees.percentage) / 100 : 0,
        platformFixed: hasPlatformFee ? Number(preview?.fixed_fee_converted ?? configuration?.application_fees.fixed ?? 0) : 0,
        stripeRate: stripePercentage / 100,
        stripeFixed: Number(preview?.stripe_fee_fixed ?? account.stripe_processing_fees?.fixed ?? 0),
    };

    const storedChoice = (): FeeChoice | null => {
        const processing = !!settings.pass_processing_fee_to_buyer;
        if (!hasPlatformFee) {
            return processing ? 'pass' : 'absorb';
        }
        const platform = !!settings.pass_platform_fee_to_buyer;
        return platform === processing ? (processing ? 'pass' : 'absorb') : null;
    };
    const [choice, setChoice] = useState<FeeChoice | null>(storedChoice);

    const queue = useSectionAutosave<EventSettings>('fees', (changes) => updateSettings.mutateAsync({
        eventId,
        eventSettings: changes,
    }));

    const choose = (value: FeeChoice) => {
        if (value === choice) {
            return;
        }
        setChoice(value);
        queue({
            pass_platform_fee_to_buyer: value === 'pass',
            pass_processing_fee_to_buyer: value === 'pass',
        });
    };

    const stripeFees = feeText(stripePercentage, rates.stripeFixed, currency);
    const platformFees = feeText(Number(configuration?.application_fees.percentage ?? 0), rates.platformFixed, currency);

    return (
        <SettingsCard
            id="platform-fees"
            className={extra.anchored}
            title={t`Ticketing fees`}
            subtitle={feesSubtitle(hasPlatformFee, platformFees, stripeFees)}
        >
            <FeeChoiceGroup choice={choice} onChoose={choose} rates={rates} currency={currency}/>
            {choice === null && (
                <p className={classes.hint} role="status">
                    {t`The platform fee and the Stripe fees are handled differently for this event. Choose an option to handle them the same way.`}
                </p>
            )}
            <p className={classes.softHint}>{t`For this event only. Estimated amounts.`}</p>
            <Link className={classes.textButton} to={`/manage/organizer/${event.organizer?.id}/settings/taxes`}>
                {t`Taxes and additional fees`} →
            </Link>
        </SettingsCard>
    );
};
