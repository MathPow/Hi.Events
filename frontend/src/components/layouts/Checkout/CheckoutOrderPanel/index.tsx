import {ReactNode, useState} from "react";
import {Button, TextInput} from "@mantine/core";
import {IconTag, IconX} from "@tabler/icons-react";
import {plural, t} from "@lingui/macro";
import {i18n} from "@lingui/core";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import {Event, Order} from "../../../../types.ts";
import {formatCurrency} from "../../../../utilites/currency.ts";
import {eventCoverImageUrl} from "../../../../utilites/urlHelper.ts";
import {getConfig} from "../../../../utilites/config.ts";
import {PublicIcon} from "../../../common/PublicIcon";
import classes from "./CheckoutOrderPanel.module.scss";

interface CheckoutOrderPanelProps {
    event: Event;
    order: Order;
    // Absent quand le code promo ne peut plus changer (apres l'etape des details).
    onPromoCodeChange?: (promoCode: string | null) => void;
    isPromoCodePending?: boolean;
    notice?: ReactNode;
}

dayjs.extend(utc);

const locale = () => i18n.locale || 'en';

// « Ven. 30 oct. · 18 h » dans le fuseau de l'evenement.
const eventDateLabel = (event: Event): string => {
    try {
        const date = dayjs.utc(event.start_date).toDate();
        const day = new Intl.DateTimeFormat(locale(), {
            weekday: 'short', day: 'numeric', month: 'short', timeZone: event.timezone,
        }).format(date);
        const time = new Intl.DateTimeFormat(locale(), {
            hour: 'numeric', minute: '2-digit', timeZone: event.timezone,
        }).format(date);

        return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time}`;
    } catch {
        return '';
    }
};

// « dollars canadiens » pour CAD: le nom de la devise au pluriel, dans la langue de la page.
const currencyName = (currency: string): string => {
    try {
        return new Intl.NumberFormat(locale(), {style: 'currency', currency, currencyDisplay: 'name'})
            .formatToParts(2)
            .find(part => part.type === 'currency')?.value || currency;
    } catch {
        return currency;
    }
};

const EventImage = ({event, className}: { event: Event, className: string }) => {
    const coverUrl = eventCoverImageUrl(event);

    return (
        <div className={`${classes.image} ${className}`}>
            {coverUrl ? <img src={coverUrl} alt=""/> : <PublicIcon name={'calendrier'} size={22}/>}
        </div>
    );
};

// « Votre commande » de la maquette: la colonne de droite sur ordinateur, une carte repliable
// en haut du formulaire sur telephone.
export const CheckoutOrderPanel = ({
    event,
    order,
    onPromoCodeChange,
    isPromoCodePending = false,
    notice,
}: CheckoutOrderPanelProps) => {
    const [expanded, setExpanded] = useState(false);
    const [promoCodeInput, setPromoCodeInput] = useState('');

    const currency = order.currency;
    const totalAmount = order.total_refunded
        ? order.total_gross - order.total_refunded
        : order.total_gross;
    const fees = order.taxes_and_fees_rollup?.fees ?? [];
    const taxes = order.taxes_and_fees_rollup?.taxes ?? [];
    const totalFee = fees.reduce((sum, fee) => sum + fee.value, 0);
    const totalTax = taxes.reduce((sum, tax) => sum + tax.value, 0);
    const totalDiscount = order.order_items?.reduce((sum, item) => {
        if (item.total_before_discount && item.total_before_additions) {
            return sum + (item.total_before_discount - item.total_before_additions);
        }
        return sum;
    }, 0) || 0;
    const itemCount = order.order_items?.reduce((sum, item) => sum + (item.quantity ?? 0), 0) ?? 0;
    const location = event.settings?.location_details?.venue_name
        || event.settings?.location_details?.city
        || null;
    const eventMeta = [eventDateLabel(event), location].filter(Boolean).join(' · ');
    const currencyLabel = currencyName(currency);
    const isPromoCodeEditable = typeof onPromoCodeChange === 'function';

    const handleApplyPromoCode = () => {
        const promoCode = promoCodeInput.trim();

        if (promoCode !== '') {
            onPromoCodeChange?.(promoCode);
        }
    };

    return (
        <aside className={classes.panel} data-expanded={expanded || undefined}>
            <button
                type="button"
                className={classes.toggle}
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
            >
                <EventImage event={event} className={classes.toggleImage}/>
                <span className={classes.toggleText}>
                    <span className={classes.toggleTitle}>{t`Your Order`}</span>
                    <span className={classes.toggleMeta}>
                        {plural(itemCount, {one: '# ticket', other: '# tickets'})}
                    </span>
                </span>
                <span className={classes.toggleTotal}>{formatCurrency(totalAmount, currency)}</span>
                <PublicIcon name={'chevron'} size={18} className={classes.chevron}/>
            </button>

            <div className={classes.body}>
                <h2 className={classes.title}>{t`Your Order`}</h2>

                <div className={classes.event}>
                    <EventImage event={event} className={classes.eventImage}/>
                    <div className={classes.eventText}>
                        <span className={classes.eventTitle}>{event.title}</span>
                        {eventMeta && <span className={classes.eventMeta}>{eventMeta}</span>}
                    </div>
                </div>

                <hr className={classes.separator}/>

                {order.order_items?.map((item) => (
                    <div key={item.id} className={classes.line}>
                        {/* eslint-disable-next-line lingui/no-unlocalized-strings */}
                        <span className={classes.lineLabel}>{item.item_name} × {item.quantity}</span>
                        <span className={classes.lineValue}>
                            {!!item.price_before_discount && (
                                <s className={classes.originalPrice}>
                                    {formatCurrency(item.price_before_discount * item.quantity, currency)}
                                </s>
                            )}
                            {formatCurrency(item.price * item.quantity, currency)}
                        </span>
                    </div>
                ))}

                {!!order.platform_contribution && order.platform_contribution > 0 && (
                    <div className={classes.line}>
                        <span className={classes.lineLabel}>
                            {getConfig('VITE_PLATFORM_SUPPORT_LABEL') || t`Support the platform`}
                        </span>
                        <span className={classes.lineValue}>
                            {formatCurrency(order.platform_contribution, currency)}
                        </span>
                    </div>
                )}

                <div className={classes.line}>
                    <span className={classes.lineLabel}>
                        {t`Fees`}
                        {fees.length > 0 && (
                            <span className={classes.lineDetail}>{fees.map(fee => fee.name).join(' + ')}</span>
                        )}
                    </span>
                    <span className={classes.lineValue}>{formatCurrency(totalFee, currency)}</span>
                </div>

                {totalTax > 0 && (
                    <div className={classes.line}>
                        <span className={classes.lineLabel}>
                            {t`Taxes`}
                            <span className={classes.lineDetail}>{taxes.map(tax => tax.name).join(' + ')}</span>
                        </span>
                        <span className={classes.lineValue}>{formatCurrency(totalTax, currency)}</span>
                    </div>
                )}

                {order.promo_code && (
                    <div className={classes.line}>
                        <span className={classes.promoApplied}>
                            <IconTag size={16}/>
                            {order.promo_code}
                        </span>
                        <span className={classes.lineValue}>
                            {totalDiscount > 0 && `-${formatCurrency(totalDiscount, currency)}`}
                            {isPromoCodeEditable && (
                                <button
                                    type="button"
                                    className={classes.promoRemove}
                                    disabled={isPromoCodePending}
                                    onClick={() => {
                                        setPromoCodeInput('');
                                        onPromoCodeChange?.(null);
                                    }}
                                    aria-label={t`Remove promo code`}
                                    title={t`Remove promo code`}
                                >
                                    <IconX size={14}/>
                                </button>
                            )}
                        </span>
                    </div>
                )}

                {isPromoCodeEditable && !order.promo_code && (
                    <div className={classes.promoForm}>
                        <TextInput
                            className={classes.promoInput}
                            aria-label={t`Promo code`}
                            placeholder={t`Promo code`}
                            value={promoCodeInput}
                            disabled={isPromoCodePending}
                            onChange={(event) => setPromoCodeInput(event.currentTarget.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    handleApplyPromoCode();
                                }
                            }}
                        />
                        <Button
                            className={classes.promoButton}
                            disabled={isPromoCodePending || promoCodeInput.trim() === ''}
                            loading={isPromoCodePending}
                            onClick={handleApplyPromoCode}
                        >
                            {t`Apply`}
                        </Button>
                    </div>
                )}

                <hr className={classes.separator}/>

                <div className={classes.total}>
                    <span className={classes.totalLabel}>{t`Total`}</span>
                    <span className={classes.totalValue}>{formatCurrency(totalAmount, currency)}</span>
                </div>

                {!!order.deposit_amount && order.deposit_amount > 0 && (
                    <div className={classes.line}>
                        <span className={classes.lineLabel}>
                            {t`Security deposit`}
                            <span className={classes.lineDetail}>{t`Sent separately, not included in the total`}</span>
                        </span>
                        <span className={classes.lineValue}>{formatCurrency(order.deposit_amount, currency)}</span>
                    </div>
                )}

                <p className={classes.note}>
                    {t`Prices in ${currencyLabel}, taxes included where applicable.`}
                </p>

                {notice}
            </div>
        </aside>
    );
};
