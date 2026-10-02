import {t} from "@lingui/macro";
import {useNavigate} from "react-router";
import {useMutation} from "@tanstack/react-query";
import {IconTicket} from "@tabler/icons-react";
import {orderClientPublic, ProductFormPayload} from "../../../../api/order.client.ts";
import {Event, Product, ProductPriceType, ProductType} from "../../../../types.ts";
import {ProductPriceDisplay} from "../../../common/Currency";
import {getSessionIdentifier} from "../../../../utilites/sessionIdentifier.ts";
import {CHECKOUT_PREFILL_PARAM_KEYS} from "../../../../hooks/useCheckoutPrefill.ts";
import {showError} from "../../../../utilites/notifications.tsx";
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
    product: Product;
    visible: boolean;
    promoCode?: string | null;
    onSeeAllTickets?: () => void;
}

export const StickyBuyBar = ({event, product, visible, promoCode, onSeeAllTickets}: StickyBuyBarProps) => {
    const navigate = useNavigate();
    const price = product.prices![0];
    const quantity = Math.max(1, product.min_per_order || 1);

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
        orderMutation.mutate({
            products: [{
                product_id: Number(product.id),
                quantities: [{price_id: Number(price.id), quantity}],
            }],
            promo_code: promoCode || null,
            affiliate_code: getStoredAffiliateCode(Number(event.id)),
            session_identifier: getSessionIdentifier(),
        });
    };

    return (
        <div className={`${classes.bar} ${visible ? classes.visible : ''}`} aria-hidden={!visible}>
            <div className={classes.inner}>
                <div className={classes.info}>
                    <div className={classes.title}>{product.title}</div>
                    <div className={classes.priceRow}>
                        <ProductPriceDisplay
                            price={price}
                            product={product}
                            currency={event.currency}
                            className={classes.price}
                            freeLabel={t`Free`}
                            taxAndServiceFeeDisplayType={event.settings?.price_display_mode}
                        />
                        {onSeeAllTickets && (
                            <button type="button" className={classes.seeAll} onClick={onSeeAllTickets} tabIndex={visible ? 0 : -1}>
                                {t`See all tickets`}
                            </button>
                        )}
                    </div>
                </div>
                <button
                    type="button"
                    className={classes.buyButton}
                    onClick={handleBuy}
                    disabled={orderMutation.isPending || orderMutation.isSuccess}
                    tabIndex={visible ? 0 : -1}
                >
                    <IconTicket size={18}/>
                    {orderMutation.isPending || orderMutation.isSuccess ? t`Processing...` : t`Buy`}
                </button>
            </div>
        </div>
    );
};
