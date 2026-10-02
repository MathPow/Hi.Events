import {Attendee, Product, ProductPriceType} from "../types.ts";

export const hasMultiplePrices = (product?: Pick<Product, 'type'>): boolean => {
    return product?.type === ProductPriceType.Tiered || product?.type === ProductPriceType.Sized;
}

export const getAttendeeProductTitle = (attendee: Attendee, product: Product): string => {
    if (!hasMultiplePrices(product)) {
        return product.title;
    }

    const productPrice = product.prices
        ?.find(price => price.id === attendee.product_price_id);

    return product.title + (productPrice?.label ? ` - ${productPrice.label}` : '');
}

export const getAttendeeProductPrice = (attendee: Attendee, product: Product): number => {
    const productPrice = product.prices
        ?.find(price => price.id === attendee.product_price_id);

    return productPrice?.price ?? 0;
}
