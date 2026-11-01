import {useState} from "react";
import {t} from "@lingui/macro";
import {Account, IdParam, OrganizerSettings} from "../../../../../types.ts";
import {useUpdateOrganizerSettings} from "../../../../../mutations/useUpdateOrganizerSettings.ts";
import {formatCurrency} from "../../../../../utilites/currency.ts";
import {intlLocale} from "../../../../../utilites/intlLocale.ts";
import {useSectionAutosave} from "../../../../layouts/AppLayout/PageStatus.tsx";
import {SettingsCard, Tag} from "../SettingsUi.tsx";
import classes from "../Settings.module.scss";

export const SAMPLE_PRICE = 50;

export type FeeChoice = 'pass' | 'absorb';

export interface Rates {
    platformRate: number;
    platformFixed: number;
    stripeRate: number;
    stripeFixed: number;
}

const round = (value: number) => Math.round(value * 100) / 100;

// The same arithmetic as the checkout (OrderProcessingFeePassThroughService): passed on, both fees are
// grossed up so that the organizer still receives the ticket price once Stripe and the platform took theirs.
export const feeExample = (price: number, choice: FeeChoice, {platformRate, platformFixed, stripeRate, stripeFixed}: Rates) => {
    if (choice === 'pass') {
        const denominator = 1 - platformRate - stripeRate;
        const buyerPays = denominator > 0 ? (price + platformFixed + stripeFixed) / denominator : price;
        return {buyerPays: round(buyerPays), youReceive: price};
    }

    const fees = platformFixed + price * platformRate + stripeFixed + price * stripeRate;
    return {buyerPays: price, youReceive: round(price - fees)};
};

const percent = (value: number) => new Intl.NumberFormat(intlLocale(), {
    style: 'percent',
    maximumFractionDigits: 2,
}).format(value / 100);

export const feeText = (percentage: number, fixed: number, currency: string) => fixed > 0
    ? `${percent(percentage)} + ${formatCurrency(fixed, currency)}`
    : percent(percentage);

// « Frais de plateforme 2,5 % par billet + frais Stripe (2,9 % + 0,30 $) ».
export const feesSubtitle = (hasPlatformFee: boolean, platformFees: string, stripeFees: string) => hasPlatformFee
    ? t`${platformFees} per ticket + Stripe fees (${stripeFees}). Nothing on free events.`
    : t`Stripe fees only (${stripeFees}). Nothing on free events.`;

interface FeeChoiceGroupProps {
    choice: FeeChoice | null;
    onChoose: (choice: FeeChoice) => void;
    rates: Rates;
    currency: string;
    disabled?: boolean;
}

// « Qui paie les frais? »: passed on or absorbed, each with its example in figures.
export const FeeChoiceGroup = ({choice, onChoose, rates, currency, disabled}: FeeChoiceGroupProps) => {
    const options: { value: FeeChoice, title: string, text: string, recommended?: boolean }[] = [
        {
            value: 'pass',
            title: t`Pass on to the buyer`,
            text: t`The fees are added to the ticket price. You receive the full price.`,
            recommended: true,
        },
        {
            value: 'absorb',
            title: t`Absorb the fees`,
            text: t`The buyer pays the price shown. The fees are taken from your sales.`,
        },
    ];

    return (
        <>
            <p className={classes.fieldLabel}>{t`Who pays the fees?`}</p>
            <div className={classes.feeOptions} role="radiogroup" aria-label={t`Who pays the fees?`}>
                {options.map(option => {
                    const example = feeExample(SAMPLE_PRICE, option.value, rates);
                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={choice === option.value}
                            className={classes.feeOption}
                            disabled={disabled}
                            onClick={() => onChoose(option.value)}
                        >
                            <span className={classes.radio}/>
                            <span className={classes.feeOptionBody}>
                                <span className={classes.feeOptionHead}>
                                    <span className={classes.feeOptionTitle}>{option.title}</span>
                                    {option.recommended && <Tag tone="ink">{t`Recommended`}</Tag>}
                                </span>
                                <span className={classes.feeOptionText}>{option.text}</span>
                                <span className={classes.feeExample}>
                                    <span className={classes.feeFigure}>
                                        <span className={classes.feeFigureLabel}>{t`Ticket`}</span>
                                        <span className={classes.feeFigureValue}>{formatCurrency(SAMPLE_PRICE, currency)}</span>
                                    </span>
                                    <span className={classes.feeFigure}>
                                        <span className={classes.feeFigureLabel}>{t`Buyer pays`}</span>
                                        <span className={classes.feeFigureValue}>{formatCurrency(example.buyerPays, currency)}</span>
                                    </span>
                                    <span className={classes.feeFigure}>
                                        <span className={classes.feeFigureLabel}>{t`You receive`}</span>
                                        <span className={classes.feeFigureValue}>{formatCurrency(example.youReceive, currency)}</span>
                                    </span>
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </>
    );
};

interface FeesCardProps {
    organizerId: IdParam;
    account: Account;
    settings: OrganizerSettings;
    currency: string;
}

/**
 * « Frais de la billetterie »: one choice, passed on to the buyer or absorbed, for both the platform fee
 * and Stripe's processing fee (the two settings of new events), with an example in figures.
 */
export const FeesCard = ({organizerId, account, settings, currency}: FeesCardProps) => {
    const updateSettings = useUpdateOrganizerSettings();
    const configuration = account.configuration;
    // Platform fees only exist in Saas mode, and some plans have none.
    const hasPlatformFee = !!account.is_saas_mode_enabled && !!configuration && !configuration.bypass_application_fees
        && (Number(configuration.application_fees?.percentage) > 0 || Number(configuration.application_fees?.fixed) > 0);
    const rates: Rates = {
        platformRate: hasPlatformFee ? Number(configuration?.application_fees.percentage) / 100 : 0,
        platformFixed: hasPlatformFee ? Number(configuration?.application_fees.fixed) : 0,
        stripeRate: Number(account.stripe_processing_fees?.percentage ?? 0) / 100,
        stripeFixed: Number(account.stripe_processing_fees?.fixed ?? 0),
    };

    const storedChoice = (): FeeChoice | null => {
        const processing = !!settings.default_pass_processing_fee_to_buyer;
        if (!hasPlatformFee) {
            return processing ? 'pass' : 'absorb';
        }
        const platform = !!settings.default_pass_platform_fee_to_buyer;
        return platform === processing ? (processing ? 'pass' : 'absorb') : null;
    };
    const [choice, setChoice] = useState<FeeChoice | null>(storedChoice);

    const queue = useSectionAutosave<OrganizerSettings>('fees', (changes) => updateSettings.mutateAsync({
        organizerId,
        organizerSettings: changes,
    }));

    const choose = (value: FeeChoice) => {
        if (value === choice) {
            return;
        }
        setChoice(value);
        queue({
            default_pass_platform_fee_to_buyer: value === 'pass',
            default_pass_processing_fee_to_buyer: value === 'pass',
        });
    };

    const stripeFees = feeText(Number(account.stripe_processing_fees?.percentage ?? 0), rates.stripeFixed, currency);
    const platformFees = feeText(Number(configuration?.application_fees.percentage ?? 0), rates.platformFixed, configuration?.application_fees.currency || currency);
    return (
        <SettingsCard title={t`Ticketing fees`} subtitle={feesSubtitle(hasPlatformFee, platformFees, stripeFees)}>
            <FeeChoiceGroup choice={choice} onChoose={choose} rates={rates} currency={currency}/>
            <p className={classes.softHint}>{t`Default value. Can be changed for each event. Estimated amounts.`}</p>
        </SettingsCard>
    );
};
