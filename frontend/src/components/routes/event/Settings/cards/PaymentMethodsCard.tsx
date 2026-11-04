import {ReactNode} from "react";
import {t} from "@lingui/macro";
import {Link} from "react-router";
import {Switch} from "@mantine/core";
import {Event, EventSettings, IdParam, PaymentProvider} from "../../../../../types.ts";
import {useUpdateEventSettings} from "../../../../../mutations/useUpdateEventSettings.ts";
import {Editor} from "../../../../common/Editor";
import {LiquidTokenControl} from "../../../../common/Editor/Controls/LiquidTokenControl";
import {SettingsCard, ToggleRow} from "../../../organizer/Settings/SettingsUi.tsx";
import {htmlOrNull, useAutosaveForm} from "../useAutosaveForm.ts";
import {fieldIcon} from "../fieldParts.tsx";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

interface Methods {
    payment_providers: PaymentProvider[];
    offline_payment_instructions: string;
    allow_orders_awaiting_offline_payment_to_check_in: boolean;
}

// Offline payments need their instructions: both always leave together.
const PROVIDERS: (keyof Methods)[] = ['payment_providers', 'offline_payment_instructions'];

/**
 * « Méthodes de paiement » (named in the help center): Stripe and the offline payments (Interac
 * e-Transfer…), with their instructions and whether unpaid orders can check in.
 */
export const PaymentMethodsCard = ({eventId, event, settings}: { eventId: IdParam, event: Event, settings: EventSettings }) => {
    const updateSettings = useUpdateEventSettings();
    const {form, commit, choose} = useAutosaveForm<Methods>({
        key: 'payment-methods',
        initialValues: {
            payment_providers: settings.payment_providers ?? [],
            offline_payment_instructions: settings.offline_payment_instructions ?? '',
            allow_orders_awaiting_offline_payment_to_check_in: !!settings.allow_orders_awaiting_offline_payment_to_check_in,
        },
        html: ['offline_payment_instructions'],
        save: (changes, values) => updateSettings.mutateAsync({
            eventId,
            eventSettings: {
                ...changes,
                ...(('payment_providers' in changes || 'offline_payment_instructions' in changes) && {
                    payment_providers: values.payment_providers,
                    offline_payment_instructions: htmlOrNull(values.offline_payment_instructions) as string,
                }),
            },
        }),
    });

    const providers = form.values.payment_providers;
    const offline = providers.includes('OFFLINE');

    const toggle = (provider: PaymentProvider, checked: boolean) => choose(
        'payment_providers',
        checked ? [...providers.filter(item => item !== provider), provider] : providers.filter(item => item !== provider),
        PROVIDERS,
    );

    const method = (provider: PaymentProvider, title: string, under: ReactNode) => (
        <div className={extra.methodHead}>
            <span className={provider === 'STRIPE' ? classes.pastille : `${classes.pastille} ${extra.pastilleNeutral}`}>
                {fieldIcon(provider === 'STRIPE' ? 'carte-20' : 'banque')}
            </span>
            <span className={classes.toggleText}>
                <span className={classes.toggleLabel} id={`payment-${provider}`}>{title}</span>
                {under}
            </span>
            <Switch
                className={classes.switch}
                withThumbIndicator={false}
                checked={providers.includes(provider)}
                aria-labelledby={`payment-${provider}`}
                onChange={(changeEvent) => toggle(provider, changeEvent.currentTarget.checked)}
            />
        </div>
    );

    return (
        <SettingsCard
            id="payment-settings"
            className={extra.anchored}
            title={t`Payment Methods`}
            subtitle={t`How buyers can pay.`}
        >
            <div className={extra.methods}>
                <div className={extra.method}>
                    {method('STRIPE', t`Credit card (Stripe)`, (
                        <Link className={extra.methodLink} to={`/manage/organizer/${event.organizer?.id}/settings/payments`}>
                            {t`Manage the Stripe account`}
                            <img src="/interface/admin/parametres/fleche-accent.svg" width={14} height={14} alt=""/>
                        </Link>
                    ))}
                </div>

                <div className={extra.method}>
                    {method('OFFLINE', t`Offline payment`, (
                        <span className={classes.toggleHint}>
                            {t`Interac e-Transfer, cheque or cash. You confirm the payment by hand.`}
                        </span>
                    ))}

                    {offline && (
                        <div className={extra.methodBody}>
                            <div className={`${classes.notice} ${classes.noticeWarning}`}>
                                <span>
                                    <strong>{t`Free with Billetterie Dehors`}</strong>
                                    {' · '}
                                    {t`Offline payments, like Interac e-Transfer, are free: no Billetterie Dehors fees. In return, if you make any content for your event (posts, stories, posters), give Billetterie Dehors a shout-out.`}
                                </span>
                            </div>
                            <ul className={extra.bullets}>
                                <li>{t`When offline payments are enabled, users will be able to complete their orders and receive their tickets. Their tickets will clearly indicate the order is not paid, and the check-in tool will notify the check-in staff if an order requires payment.`}</li>
                                <li>{t`You will have to mark an order as paid manually. This can be done on the manage order page.`}</li>
                                <li>{t`Offline orders are not reflected in event statistics until the order is marked as paid.`}</li>
                            </ul>
                            <Editor
                                className={`${classes.description} ${extra.editor}`}
                                editorType="simple"
                                label={t`Payment instructions`}
                                description={t`Shown on the payment page, the order summary and the confirmation email (e.g. where to send the Interac e-Transfer, the deadline).`}
                                value={form.values.offline_payment_instructions}
                                error={form.errors.offline_payment_instructions as string | undefined}
                                onChange={(value) => form.setFieldValue('offline_payment_instructions', value)}
                                onBlur={() => commit(PROVIDERS)}
                                additionalToolbarControls={(
                                    <LiquidTokenControl
                                        templateType="order_confirmation"
                                        excludeTokens={[
                                            '{{ settings.offline_payment_instructions }}', // eslint-disable-line lingui/no-unlocalized-strings
                                            '{{ settings.post_checkout_message }}', // eslint-disable-line lingui/no-unlocalized-strings
                                        ]}
                                    />
                                )}
                            />
                            <ToggleRow
                                label={t`Allow attendees associated with unpaid orders to check in`}
                                hint={t`If enabled, check-in staff can either mark attendees as checked in or mark the order as paid and check in the attendees. If disabled, attendees associated with unpaid orders cannot be checked in.`}
                                checked={form.values.allow_orders_awaiting_offline_payment_to_check_in}
                                onChange={(checked) => choose('allow_orders_awaiting_offline_payment_to_check_in', checked)}
                            />
                        </div>
                    )}
                </div>
            </div>
            {form.errors.payment_providers && <p className={classes.hint} role="alert">{form.errors.payment_providers}</p>}
        </SettingsCard>
    );
};
