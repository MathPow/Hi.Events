import {t} from "@lingui/macro";
import {useNavigate} from "react-router";
import {useMutation} from "@tanstack/react-query";
import {orderClientPublic, ProductFormPayload} from "../../../../api/order.client.ts";
import {Event, Product, ProductPriceType, ProductType} from "../../../../types.ts";
import {ProductPriceDisplay} from "../../../common/Currency";
import {PublicIcon} from "../../../common/PublicIcon";
import {getSessionIdentifier} from "../../../../utilites/sessionIdentifier.ts";
import {formatCurrency} from "../../../../utilites/currency.ts";
import {CHECKOUT_PREFILL_PARAM_KEYS} from "../../../../hooks/useCheckoutPrefill.ts";
import {showError} from "../../../../utilites/notifications.tsx";
import {ProductSelectionSummary} from "../../../routes/product-widget/SelectProducts";
import classes from "./StickyBuyBar.module.scss";

const AFFILIATE_EXPIRY_DAYS = 30;

export const findDefaultTicket = (event: Event): Product | undefined => {
    const products = event.product_categories?.flatMap(c => c.products || []) || [];

    return products.find(product =>
        product.product_type === ProductType.Ticket
        && product.is_available
        && !product.is_sold_out
        && product.type !== ProductPriceType.Donation
        && product.type !== ProductPriceType.Tiered
        && product.type !== ProductPriceType.Sized
        && product.prices?.length === 1
        && product.prices[0].is_available !== false
    );
};

const getStoredAffiliateCode = (eventId: number): string | null => {
    try {
        const stored = localStorage.getItem('affiliate_code_' + eventId);
        if (!stored) {
            return null;
        }
        const parsed = JSON.parse(stored);
        const ageInDays = (Date.now() - parsed.timestamp) / (1000 * 60 * 60 * 24);
        return ageInDays <= AFFILIATE_EXPIRY_DAYS ? parsed.code : null;
    } catch {
        return null;
    }
};

const getPrefillQuery = (): string => {
    const sourceParams = new URLSearchParams(window.location.search);
    const prefillParams = new URLSearchParams();
    CHECKOUT_PREFILL_PARAM_KEYS.forEach((key) => {
        const value = sourceParams.get(key);
        if (value !== null) {
            prefillParams.set(key, value);
        }
    });
    return prefillParams.toString();
};

interface StickyBuyBarProps {
    event: Event;
    // Le formulaire du widget de billets, soumis par le bouton Continuer de la barre.
    formId: string;
    selection: ProductSelectionSummary | null;
    defaultTicket?: Product;
    ticketsOutOfView: boolean;
    promoCode?: string | null;
    onSeeAllTickets?: () => void;
    onShowTickets: () => void;
}

// La barre collante du bas de l'ecran (mobile et tablette): le total de la selection et Continuer.
// Sans selection, quand les billets sont hors de vue, elle propose l'achat rapide du billet par
// defaut ou ramene aux billets.
export const StickyBuyBar = ({
                                 event,
                                 formId,
                                 selection,
                                 defaultTicket,
                                 ticketsOutOfView,
                                 promoCode,
                                 onSeeAllTickets,
                                 onShowTickets,
                             }: StickyBuyBarProps) => {
    const navigate = useNavigate();
    const hasSelection = !!selection && selection.quantity > 0;
    const visible = hasSelection || ticketsOutOfView;

    const orderMutation = useMutation({
        mutationFn: (payload: ProductFormPayload) => orderClientPublic.create(Number(event.id), payload),
        onSuccess: (data) => {
            const prefillQuery = getPrefillQuery();
            navigate('/checkout/' + event.id + '/' + data.data.short_id + '/details' + (prefillQuery ? '?' + prefillQuery : ''));
        },
        onError: (error: any) => {
            showError(error?.response?.data?.errors?.products?.[0] || error?.response?.data?.message || t`Unable to create product. Please check your details`);
        },
    });

    const handleBuy = () => {
        if (!defaultTicket) {
            return;
        }
        const price = defaultTicket.prices![0];
        orderMutation.mutate({
            products: [{
                product_id: Number(defaultTicket.id),
                quantities: [{price_id: Number(price.id), quantity: Math.max(1, defaultTicket.min_per_order || 1)}],
            }],
            promo_code: promoCode || null,
            affiliate_code: getStoredAffiliateCode(Number(event.id)),
            session_identifier: getSessionIdentifier(),
        });
    };

    const tabIndex = visible ? 0 : -1;
    const continueText = event.settings?.continue_button_text || t`Continue`;

    const renderContent = () => {
        if (selection && hasSelection) {
            return (
                <>
                    <div className={classes.info}>
                        <span className={classes.label}>
                            {selection.quantity === 1 ? t`1 ticket` : t`${Number(selection.quantity)} tickets`}
                        </span>
                        <span className={classes.amount}>{formatCurrency(selection.subtotal, event.currency)}</span>
                    </div>
                    <button
                        type="submit"
                        form={formId}
                        className={classes.button} data-rough="button"
                        disabled={!selection.canContinue || selection.isSubmitting}
                        tabIndex={tabIndex}
                    >
                        {selection.isSubmitting ? t`Processing...` : continueText}
                        <PublicIcon name={'fleche'} size={18}/>
                    </button>
                </>
            );
        }

        if (defaultTicket) {
            const isBuying = orderMutation.isPending || orderMutation.isSuccess;

            return (
                <>
                    <div className={classes.info}>
                        <span className={classes.label}>
                            <span className={classes.title}>{defaultTicket.title}</span>
                            {onSeeAllTickets && (
                                <button type="button" className={classes.seeAll} onClick={onSeeAllTickets} tabIndex={tabIndex}>
                                    {t`See all tickets`}
                                </button>
                            )}
                        </span>
                        <ProductPriceDisplay
                            price={defaultTicket.prices![0]}
                            product={defaultTicket}
                            currency={event.currency}
                            className={classes.amount}
                            freeLabel={t`Free`}
                            taxAndServiceFeeDisplayType={event.settings?.price_display_mode}
                        />
                    </div>
                    <button
                        type="button"
                        className={classes.button} data-rough="button"
                        onClick={handleBuy}
                        disabled={isBuying}
                        tabIndex={tabIndex}
                    >
                        {isBuying ? t`Processing...` : t`Buy`}
                        <PublicIcon name={'fleche'} size={18}/>
                    </button>
                </>
            );
        }

        return (
            <button type="button" className={`${classes.button} ${classes.wide}`} data-rough="button" onClick={onShowTickets} tabIndex={tabIndex}>
                <PublicIcon name={'billet'} size={18}/>
                {t`Get Tickets`}
            </button>
        );
    };

    return (
        <div className={`${classes.bar} ${visible ? classes.visible : ''}`} aria-hidden={!visible}>
            {renderContent()}
        </div>
    );
};
