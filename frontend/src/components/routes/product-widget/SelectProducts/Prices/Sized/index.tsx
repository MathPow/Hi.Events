import {Currency, ProductPriceDisplay} from "../../../../../common/Currency";
import {Event, Product} from "../../../../../../types.ts";
import {Group} from "@mantine/core";
import {NumberSelector} from "../../../../../common/NumberSelector";
import {UseFormReturnType} from "@mantine/form";
import {t} from "@lingui/macro";
import {ProductPriceAvailability} from "../../../../../common/ProductPriceAvailability";

interface SizedPricingProps {
    event: Event;
    product: Product;
    form: UseFormReturnType<any>;
    productIndex: number;
}

export const SizedPricing = ({product, event, form, productIndex}: SizedPricingProps) => {
    const sharedPrice = product.prices?.[0];

    return (
        <>
            {sharedPrice && (
                <div className={'hi-sized-price'}>
                    <ProductPriceDisplay
                        price={sharedPrice}
                        product={product}
                        currency={event?.currency}
                        className={'hi-price-tier-price-amount'}
                        freeLabel={t`Free`}
                        taxAndServiceFeeDisplayType={event?.settings?.price_display_mode}
                    />
                    {sharedPrice.is_discounted && (
                        <div style={{textDecoration: 'line-through', fontSize: '.9em'}}>
                            <Currency
                                price={sharedPrice.price_before_discount}
                                currency={event?.currency}
                                className={'hi-price-tier-price-amount'}
                            />
                        </div>
                    )}
                </div>
            )}

            <div className={'hi-sized-heading'}>{t`Choose your size`}</div>

            {product?.prices?.map((price, index) => (
                <div key={price.id ?? index} className={'hi-price-tier-row hi-size-row'}>
                    <Group justify={'space-between'} wrap={'nowrap'}>
                        <div className={'hi-price-tier'}>
                            <div className={'hi-price-tier-label'}>{price.label}</div>
                        </div>
                        <div className={'hi-product-quantity-selector'}>
                            {(product.is_available && price.is_available) && (
                                <>
                                    <NumberSelector
                                        className={'hi-product-quantity-selector'}
                                        min={product.min_per_order ?? 0}
                                        max={(Math.min(price.quantity_remaining ?? 50, product.max_per_order ?? 50))}
                                        fieldName={`products.${productIndex}.quantities.${index}.quantity`}
                                        formInstance={form}
                                    />
                                    {form.errors[`products.${productIndex}.quantities.${index}.quantity`] && (
                                        <div className={'hi-product-quantity-error'}>
                                            {form.errors[`products.${productIndex}.quantities.${index}.quantity`]}
                                        </div>
                                    )}
                                </>
                            )}
                            {(!product.is_available || !price.is_available) && (
                                <ProductPriceAvailability product={product} price={price} event={event}/>
                            )}
                        </div>
                    </Group>
                </div>
            ))}
        </>
    );
}
