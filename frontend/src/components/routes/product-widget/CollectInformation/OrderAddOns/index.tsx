import {t} from "@lingui/macro";
import {Menu, UnstyledButton} from "@mantine/core";
import {Event, IdParam, Order, Product, ProductPrice, ProductPriceType} from "../../../../../types.ts";
import {formatCurrency} from "../../../../../utilites/currency.ts";
import {showError} from "../../../../../utilites/notifications.tsx";
import {useSetOrderProductQuantity} from "../../../../../mutations/useSetOrderProductQuantity.ts";
import {CheckoutSection} from "../../../../layouts/Checkout/CheckoutColumns";
import {PublicIcon} from "../../../../common/PublicIcon";
import classes from "./OrderAddOns.module.scss";

interface OrderAddOnsProps {
    number: number;
    event: Event;
    order: Order;
    products: Product[];
}

const isPriceOnSale = (price: ProductPrice) =>
    price.is_available !== false && !price.is_sold_out && !price.is_hidden;

// La merch qu'on peut encore ajouter: produits GENERAL (pas les billets, qui demandent un
// participant, ni les dons, qui demandent un montant), en vente, avec au moins un prix en vente.
const addOnProducts = (products: Product[]): Product[] => products.filter((product) =>
    product.product_type === 'GENERAL'
    && product.type !== ProductPriceType.Donation
    && product.is_available !== false
    && !product.is_sold_out
    && !!product.prices?.some(isPriceOnSale));

const priceAmount = (price: ProductPrice, event: Event) => price.price
    + (event.settings?.price_display_mode === 'INCLUSIVE' ? (price.tax_total || 0) + (price.fee_total || 0) : 0);

const priceLabel = (amount: number, event: Event) => amount === 0 ? t`Free` : formatCurrency(amount, event.currency);

// Un prix, ou l'ecart entre le plus bas et le plus haut (les tailles, les paliers).
const productPriceLabel = (prices: ProductPrice[], event: Event) => {
    const amounts = prices.map((price) => priceAmount(price, event));
    const lowest = Math.min(...amounts);
    const highest = Math.max(...amounts);

    return lowest === highest
        ? priceLabel(lowest, event)
        : `${priceLabel(lowest, event)} – ${priceLabel(highest, event)}`;
};

const errorMessage = (error: unknown): string => {
    const data = (error as { response?: { data?: { message?: string, errors?: Record<string, string[] | string> } } })
        ?.response?.data;
    const firstError = data?.errors && Object.values(data.errors)[0];

    return (Array.isArray(firstError) ? firstError[0] : firstError) || data?.message || t`Something went wrong`;
};

/**
 * « Ajouter a votre commande » de la maquette (Public · Checkout 424:184, telephone 418:146):
 * la merch de l'evenement, a recuperer sur place, ajoutee a la commande reservee avant le paiement.
 */
export const OrderAddOns = ({number, event, order, products}: OrderAddOnsProps) => {
    const mutation = useSetOrderProductQuantity();
    const offered = addOnProducts(products);

    if (offered.length === 0) {
        return null;
    }

    const quantityInOrder = (priceId: IdParam | undefined) => (order.order_items ?? [])
        .filter((item) => item.product_price_id === priceId)
        .reduce((sum, item) => sum + (item.quantity ?? 0), 0);

    const setQuantity = (product: Product, price: ProductPrice, quantity: number) => {
        mutation.mutate({
            eventId: event.id as IdParam,
            orderShortId: order.short_id as IdParam,
            productId: product.id as IdParam,
            productPriceId: price.id as IdParam,
            quantity,
        }, {
            onError: (error) => showError(errorMessage(error)),
        });
    };

    const busy = mutation.isPending;

    return (
        <CheckoutSection
            number={number}
            title={t`Add to your order`}
            subtitle={t`Merch to pick up on site, on the day of the event.`}
        >
            <div className={classes.grid}>
                {offered.map((product) => {
                    const title = product.title;
                    const onSale = (product.prices ?? []).filter(isPriceOnSale);
                    const single = onSale.length === 1 ? onSale[0] : null;
                    const singleQuantity = single ? quantityInOrder(single.id) : 0;
                    // Les tailles (ou paliers) deja dans la commande, chacune retirable.
                    const chosen = single ? [] : (product.prices ?? [])
                        .map((price) => ({price, quantity: quantityInOrder(price.id)}))
                        .filter(({quantity}) => quantity > 0);

                    return (
                        <div key={product.id} className={classes.card} data-rough>
                            <span className={classes.image} data-rough aria-hidden>
                                <PublicIcon name={'etiquette'} size={24}/>
                            </span>

                            <div className={classes.text}>
                                <span className={classes.name}>{product.title}</span>
                                <span className={classes.price}>{productPriceLabel(onSale, event)}</span>
                                {chosen.length > 0 && (
                                    <span className={classes.chosen}>
                                        {chosen.map(({price, quantity}) => (
                                            <button key={price.id} type="button" className={classes.chip} disabled={busy}
                                                    title={t`Remove`}
                                                    onClick={() => setQuantity(product, price, 0)}>
                                                {price.label || product.title} × {quantity}
                                                <span aria-hidden className={classes.chipRemove}>×</span>
                                            </button>
                                        ))}
                                    </span>
                                )}
                            </div>

                            {single ? (
                                <div className={singleQuantity > 0 ? `${classes.stepper} ${classes.stepperActive}` : classes.stepper}>
                                    {singleQuantity > 0 && (
                                        <>
                                            <UnstyledButton className={classes.round} data-rough="button" disabled={busy}
                                                            aria-label={t`Remove one ${title}`}
                                                            onClick={() => setQuantity(product, single, singleQuantity - 1)}>
                                                <PublicIcon name={'moins'} size={20}/>
                                            </UnstyledButton>
                                            <span className={classes.quantity} aria-live="polite">{singleQuantity}</span>
                                        </>
                                    )}
                                    <UnstyledButton className={classes.round} data-rough="button" disabled={busy}
                                                    aria-label={t`Add ${title}`}
                                                    onClick={() => setQuantity(product, single, singleQuantity + 1)}>
                                        <PublicIcon name={'plus'} size={20}/>
                                    </UnstyledButton>
                                </div>
                            ) : (
                                <Menu position="bottom-end" shadow="md" withinPortal disabled={busy}>
                                    <Menu.Target>
                                        <UnstyledButton className={classes.round} data-rough="button" disabled={busy}
                                                        aria-label={t`Add ${title}`}>
                                            <PublicIcon name={'plus'} size={20}/>
                                        </UnstyledButton>
                                    </Menu.Target>
                                    <Menu.Dropdown>
                                        {onSale.map((price) => (
                                            <Menu.Item key={price.id}
                                                       onClick={() => setQuantity(product, price, quantityInOrder(price.id) + 1)}
                                                       rightSection={priceLabel(priceAmount(price, event), event)}>
                                                {price.label || product.title}
                                            </Menu.Item>
                                        ))}
                                    </Menu.Dropdown>
                                </Menu>
                            )}
                        </div>
                    );
                })}
            </div>
        </CheckoutSection>
    );
};
