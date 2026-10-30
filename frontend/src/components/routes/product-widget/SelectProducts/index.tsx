import {t, Trans} from "@lingui/macro";
import {
    ActionIcon,
    Button,
    Collapse,
    Group,
    Input,
    Modal,
    Spoiler,
    TextInput,
    UnstyledButton
} from "@mantine/core";
import {useNavigate, useParams} from "react-router";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {notifications} from "@mantine/notifications";
import {
    orderClientPublic,
    ProductFormPayload,
    ProductFormValue,
    ProductPriceQuantityFormValue
} from "../../../../api/order.client.ts";
import {useForm} from "@mantine/form";
import {range, useResizeObserver} from "@mantine/hooks";
import React, {useEffect, useMemo, useRef, useState} from "react";
import {showError, showInfo, showSuccess} from "../../../../utilites/notifications.tsx";
import {addQueryStringToUrl, isObjectEmpty, removeQueryStringFromUrl} from "../../../../utilites/helpers.ts";
import {TieredPricing} from "./Prices/Tiered";
import {SizedPricing} from "./Prices/Sized";
import {hasMultiplePrices} from "../../../../utilites/products.ts";
import {formatCurrency} from "../../../../utilites/currency.ts";
import {Event, Product, ProductPriceType, TaxAndFeeType} from "../../../../types.ts";
import classNames from 'classnames';
import '../../../../styles/widget/default.scss';
import {ProductAvailabilityMessage} from "../../../common/ProductPriceAvailability";
import {PoweredByFooter} from "../../../common/PoweredByFooter";
import {eventsClientPublic} from "../../../../api/event.client.ts";
import {promoCodeClientPublic} from "../../../../api/promo-code.client.ts";
import {IconChevronRight, IconExternalLink, IconTag, IconX} from "@tabler/icons-react"
import {getSessionIdentifier} from "../../../../utilites/sessionIdentifier.ts";
import {Constants} from "../../../../constants.ts";
import {PublicIcon} from "../../../common/PublicIcon";
import {clearWaitlistJoinedForEvent} from "../../../../hooks/useWaitlistJoined.ts";
import {getProductInfoIcon} from "../../../../constants/productInfoIcons.ts";
import {CHECKOUT_PREFILL_PARAM_KEYS} from "../../../../hooks/useCheckoutPrefill.ts";

const AFFILIATE_EXPIRY_DAYS = 30;

const sendHeightToIframeWidgets = () => {
    const height = document.documentElement.scrollHeight;
    const widgetHeight = document.querySelector('.hi-product-widget-container')?.getBoundingClientRect().height || 0;
    const urlParams = new URLSearchParams(window.location.search);
    const iframeId = urlParams.get('iframeId');

    const finalHeight = Math.max(height, widgetHeight);

    if (!iframeId) {
        return;
    }

    window.parent.postMessage({
        type: 'resize',
        height: finalHeight,
        iframeId: iframeId
    }, '*');
};

// Ce que la page evenement affiche hors du widget (barre collante mobile).
export interface ProductSelectionSummary {
    quantity: number;
    subtotal: number;
    canContinue: boolean;
    isSubmitting: boolean;
}

interface SelectProductsProps {
    event: Event;
    // Page evenement: un bouton hors du widget soumet le formulaire par son id (attribut form).
    formId?: string;
    onSelectionChange?: (summary: ProductSelectionSummary) => void;
    showSubtotal?: boolean;
    collapsiblePromoCode?: boolean;
    promoCodeValid?: boolean;
    promoCode?: string;
    backgroundType?: 'COLOR' | 'MIRROR_COVER_IMAGE';
    colors?: {
        primary?: string;
        primaryText?: string;
        secondary?: string;
        secondaryText?: string;
        background?: string;
        bodyBackground?: string;
    },
    padding?: string;
    continueButtonText?: string;
    // Event page (maquette « Public · Evenement »): each product open as a card, its title and
    // description beside the price, then a note (spots left, fees) and the quantity.
    productCards?: boolean;
    widgetMode?: 'preview' | 'normal' | 'embedded';
    showPoweredBy?: boolean;
}

// A product card's price beside its title: its lowest and highest prices, taxes and fees
// included when the event shows prices that way (as ProductPriceDisplay does).
const cardPriceLabel = (product: Product, event: Event): string | null => {
    if (product.type === ProductPriceType.Donation || !product.prices?.length) {
        return null;
    }
    const inclusive = event.settings?.price_display_mode === 'INCLUSIVE';
    const prices = product.prices.map((price) => price.price
        + (inclusive ? (price.tax_total || 0) + (price.fee_total || 0) : 0));
    const lowest = Math.min(...prices);
    const highest = Math.max(...prices);

    if (highest === 0) {
        return t`Free`;
    }

    return lowest === highest
        ? formatCurrency(lowest, event.currency)
        : `${formatCurrency(lowest, event.currency)} – ${formatCurrency(highest, event.currency)}`;
};

const SelectProducts = (props: SelectProductsProps) => {
    const {eventId} = useParams();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const promoRef = useRef<HTMLInputElement>(null);
    const [event, setEvent] = useState(props.event);
    const [orderInProcessOverlayVisible, setOrderInProcessOverlayVisible] = useState(false);
    const [resizeRef, resizeObserverRect] = useResizeObserver();
    const [collapsedProducts, setCollapsedProducts] = useState<{ [key: number]: boolean }>({});
    const [affiliateCode, setAffiliateCode] = useState<string | null>(null);
    const [promoCodeOpen, setPromoCodeOpen] = useState(!props.collapsiblePromoCode);

    useEffect(() => sendHeightToIframeWidgets(), [resizeObserverRect.height]);

    useEffect(() => {
        const storageKey = 'affiliate_code_' + eventId;

        const now = Date.now();
        const affiliateCodeFromUrl = new URLSearchParams(window.location.search).get('aff');

        if (affiliateCodeFromUrl) {
            const data = {code: affiliateCodeFromUrl, timestamp: now};
            localStorage.setItem(storageKey, JSON.stringify(data));
            setAffiliateCode(affiliateCodeFromUrl);
            return;
        }

        const storedData = localStorage.getItem(storageKey);
        if (storedData) {
            try {
                const parsed = JSON.parse(storedData);
                const ageInDays = (now - parsed.timestamp) / (1000 * 60 * 60 * 24);
                if (ageInDays <= AFFILIATE_EXPIRY_DAYS) {
                    setAffiliateCode(parsed.code);
                } else {
                    localStorage.removeItem(storageKey);
                }
            } catch {
                localStorage.removeItem(storageKey);
            }
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !eventId) return;
        const clearWaitlist = new URLSearchParams(window.location.search).get('clear_waitlist');
        if (clearWaitlist === 'true') {
            clearWaitlistJoinedForEvent(eventId);
            removeQueryStringFromUrl('clear_waitlist');
        }
    }, [eventId]);

    useEffect(() => {
        form.setFieldValue('affiliate_code', affiliateCode || null);
    }, [affiliateCode]);

    const form = useForm<ProductFormPayload>({
        initialValues: {
            products: undefined,
            promo_code: props.promoCodeValid ? props.promoCode || null : null,
            affiliate_code: affiliateCode || null,
            session_identifier: undefined,
        },
    });

    const productMutation = useMutation({
        mutationFn: (orderData: ProductFormPayload) => orderClientPublic.create(Number(eventId), orderData),

        onSuccess: (data) => queryClient.invalidateQueries()
            .then(() => {
                const url = '/checkout/' + eventId + '/' + data.data.short_id + '/details';

                // Forward checkout-prefill params (name/email/lock) from the event page
                // to the details step, since this navigation would otherwise drop them.
                const sourceParams = new URLSearchParams(window.location.search);
                const prefillParams = new URLSearchParams();
                CHECKOUT_PREFILL_PARAM_KEYS.forEach((key) => {
                    const value = sourceParams.get(key);
                    if (value !== null) {
                        prefillParams.set(key, value);
                    }
                });
                const prefillQuery = prefillParams.toString();

                if (props.widgetMode === 'embedded') {
                    const embeddedQuery = 'session_identifier=' + data.data.session_identifier
                        + '&utm_source=embedded_widget'
                        + (prefillQuery ? '&' + prefillQuery : '');
                    window.open(url + '?' + embeddedQuery, '_blank');
                    setOrderInProcessOverlayVisible(true);
                    return;
                }

                return navigate(url + (prefillQuery ? '?' + prefillQuery : ''));
            }),

        onError: (error: any) => {
            if (error?.response?.data?.errors) {
                form.setErrors(error.response.data.errors);
            }

            notifications.show({
                message: error.response.data.errors?.products[0] || t`Unable to create product. Please check your details`,
                color: 'red',
            });
        }
    });

    const promoCodeEventRefetchMutation = useMutation({
        mutationFn: async (promoCode: string | null) => {
            if (promoCode) {
                const validPromoCode = await promoCodeClientPublic.validateCode(
                    eventId,
                    promoCode
                );

                if (!validPromoCode.valid) {
                    showError(t`That promo code is invalid`);
                    return;
                }
            }

            const eventWithPromoCodeApplied = await eventsClientPublic.findByID(
                eventId,
                promoCode
            );

            setEvent(eventWithPromoCodeApplied.data);

            if (promoCode) {
                form.setFieldValue("promo_code", promoCode);
            } else {
                form.setFieldValue("promo_code", null);
                removeQueryStringFromUrl('promo_code');
            }
        },
    });

    const productCategories = event?.product_categories || [];
    const productAreAvailable = productCategories && productCategories.some(category => !!category?.products?.length);
    const products: Product[] = productCategories.reduce((acc: Product[], category) => acc.concat(category.products ?? []), []);

    const selectedProductQuantitySum = useMemo(() => {
        let total = 0;
        form.values.products?.forEach(({quantities}) => {
            quantities?.forEach(({quantity}) => {
                total += Number(quantity);
            });
        });

        return total;
    }, [form.values.products]);

    // Meme prix que ProductPriceDisplay: taxes et frais inclus quand l'evenement les affiche inclus.
    const selectedProductsSubtotal = useMemo(() => {
        const taxesIncluded = event?.settings?.price_display_mode === 'INCLUSIVE';
        let subtotal = 0;
        form.values.products?.forEach(({product_id, quantities}) => {
            const product = products.find(p => Number(p.id) === Number(product_id));
            quantities?.forEach(({price_id, quantity, price: chosenPrice}) => {
                const price = product?.prices?.find(p => Number(p.id) === Number(price_id));
                if (!product || !price || !Number(quantity)) {
                    return;
                }
                let unitPrice = product.type === ProductPriceType.Donation ? Number(chosenPrice) || 0 : Number(price.price) || 0;
                if (taxesIncluded) {
                    unitPrice += (price.tax_total || 0) + (price.fee_total || 0);
                }
                subtotal += unitPrice * Number(quantity);
            });
        });

        return subtotal;
    }, [form.values.products, event]);

    useEffect(() => {
        if (props.collapsiblePromoCode && promoCodeOpen) {
            promoRef.current?.focus();
        }
    }, [promoCodeOpen]);

    useEffect(() => {
        if (form.values.promo_code) {
            const promo_code = form.values.promo_code;
            showSuccess(t`Promo ${promo_code} code applied`);
            addQueryStringToUrl('promo_code', promo_code);
        }
    }, [form.values.promo_code])

    useEffect(() => {
        if (typeof props.promoCodeValid !== 'undefined') {
            if (!props.promoCodeValid) {
                showError(t`That promo code is invalid`);
                removeQueryStringFromUrl('promo_code');
            }
        }
    }, [props.promoCodeValid])

    const populateFormValue = () => {
        const productValues: Array<ProductFormValue> = [];
        products?.forEach(product => {
            const quantitiesValues: Array<ProductPriceQuantityFormValue> = [];

            const existingProduct = form.values.products?.find(p => p.product_id === product.id);

            product.prices?.forEach(priceQuantity => {
                const existingQuantity = existingProduct?.quantities?.find(q => q.price_id === priceQuantity.id)?.quantity || 0;

                quantitiesValues.push({
                    quantity: existingQuantity,
                    price_id: Number(priceQuantity.id),
                    price: product.type === 'DONATION' ? Number(priceQuantity.price) : undefined,
                });
            });

            if (quantitiesValues.length === 0) {
                quantitiesValues.push({
                    quantity: 0,
                    price_id: 0,
                    price: 0,
                });
            }

            productValues.push({
                product_id: Number(product.id),
                quantities: quantitiesValues,
            });
        });

        if (JSON.stringify(form.values.products) !== JSON.stringify(productValues)) {
            form.setFieldValue("products", productValues);
        }
    };

    useEffect(populateFormValue, [productCategories]);

    const handleProductSelection = (values: Omit<ProductFormPayload, "session_identifier">) => {
        if (values && selectedProductQuantitySum > 0) {
            productMutation.mutate({
                ...values,
                session_identifier: getSessionIdentifier()
            });
        } else {
            showInfo(t`Please select at least one product`);
        }
    };

    const handleApplyPromoCode = () => {
        const promoCode = promoRef.current?.value;
        if (promoCode && promoCode.length >= 3) {
            promoCodeEventRefetchMutation.mutate(promoCode);
        } else {
            showError(t`Sorry, this promo code is not recognized`);
        }
    }

    const isButtonDisabled = productMutation.isPending
        || !productAreAvailable
        || selectedProductQuantitySum === 0
        || props.widgetMode === 'preview'
        || products?.every(product => product.is_sold_out);

    const {onSelectionChange} = props;
    useEffect(() => {
        onSelectionChange?.({
            quantity: selectedProductQuantitySum,
            subtotal: selectedProductsSubtotal,
            canContinue: !isButtonDisabled,
            isSubmitting: productMutation.isPending,
        });
    }, [selectedProductQuantitySum, selectedProductsSubtotal, isButtonDisabled, productMutation.isPending]);

    const productInfoMessage = event?.settings?.product_info_message;
    const productInfoButtonText = event?.settings?.product_info_button_text;
    const productInfoButtonUrl = event?.settings?.product_info_button_url;
    const hasProductInfoButton = !!productInfoButtonText && !!productInfoButtonUrl;
    const ProductInfoIcon = getProductInfoIcon(event?.settings?.product_info_icon);

    let productIndex = 0;

    // Product cards: past three lines to choose from (each price of a product counts, its
    // distances or sizes), the cards start closed on their title, description and price.
    const choiceLines = (event?.product_categories || [])
        .flatMap((category) => category.products || [])
        .reduce((lines, product) => lines + Math.max(1, product.prices?.length || 0), 0);
    const collapsibleCards = !!props.productCards && choiceLines > 3;

    return (
        <div className={'hi-product-widget-container'}
             ref={resizeRef}
             style={{
                 '--widget-background-color': props.colors?.background,
                 '--widget-primary-color': props.colors?.primary,
                 '--widget-primary-text-color': props.colors?.primaryText,
                 '--widget-secondary-color': props.colors?.secondary,
                 '--widget-secondary-text-color': props.colors?.secondaryText,
                 '--widget-padding': props?.padding,
             } as React.CSSProperties}>
            {!productAreAvailable && (
                <div className={classNames(['hi-no-products'])}>
                    <p className={classNames(['hi-no-products-message'])}>
                        {t`There are no products available for this event`}
                    </p>
                </div>
            )}
            {orderInProcessOverlayVisible && (
                <Modal
                    withCloseButton={false}
                    opened={true}
                    onClose={() => setOrderInProcessOverlayVisible(false)}
                    styles={{
                        body: {
                            padding: '30px 24px'
                        },
                        content: {
                            borderRadius: '8px',
                            backgroundColor: props.colors?.background || 'white'
                        }
                    }}
                >
                    <div style={{
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '16px',
                        color: props.colors?.primaryText || 'inherit'
                    }}>
                        <div style={{width: '100%'}}>
                            <h3 style={{
                                margin: '0 0 12px 0',
                                fontSize: '20px',
                                fontWeight: '600',
                                color: props.colors?.primaryText || 'inherit'
                            }}>
                                {t`Please continue in the new tab`}
                            </h3>

                            <p style={{
                                margin: '0 0 20px 0',
                                fontSize: '15px',
                                lineHeight: '1.5',
                                color: props.colors?.primaryText || 'inherit'
                            }}>
                                {t`If a new tab did not open automatically, please click the button below to continue to checkout.`}
                            </p>

                            <Button
                                component="a"
                                href={'/checkout/' + eventId + '/' + productMutation.data?.data.short_id + '/details' + '?session_identifier=' + productMutation.data?.data.session_identifier}
                                target={'_blank'}
                                rel={'noopener noreferrer'}
                                fullWidth
                                size="md"
                                styles={{
                                    root: {
                                        backgroundColor: props.colors?.secondary || 'var(--primary-color, #228be6)',
                                        color: props.colors?.secondaryText || 'var(--accent-contrast, white)',
                                        fontWeight: 600,
                                        marginBottom: '12px',
                                        '&:hover': {
                                            backgroundColor: props.colors?.secondary || 'var(--primary-color, #1c7ed6)',
                                            filter: 'brightness(0.95)',
                                        }
                                    }
                                }}
                            >
                                {t`Continue to Checkout`}
                            </Button>

                            <Button
                                onClick={() => setOrderInProcessOverlayVisible(false)}
                                variant={'subtle'}
                                size={'sm'}
                                styles={{
                                    root: {
                                        color: props.colors?.primaryText || 'var(--primary-color, #228be6)',
                                        '&:hover': {
                                            backgroundColor: 'transparent',
                                            textDecoration: 'underline'
                                        }
                                    }
                                }}
                            >
                                {t`Dismiss this message`}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
            {(event && productAreAvailable) && (
                <form id={props.formId} target={'__blank'} onSubmit={form.onSubmit(handleProductSelection as any)}>
                    <Input type={'hidden'} {...form.getInputProps('promo_code')} />
                    <Input type={'hidden'} {...form.getInputProps('affiliate_code')} />
                    <div className={'hi-product-category-rows'}>
                        {productCategories && productCategories.map((category) => {
                            return (
                                <div className={'hi-product-category-row'} key={category.id}>
                                    <h2 className={'hi-product-category-title'} style={category.description ? {
                                        marginBottom: '0px'
                                    } : {}}>
                                        {category.name}
                                    </h2>
                                    {category.description && (
                                        <div className={'hi-product-category-description'}>
                                            <Spoiler maxHeight={500} showLabel={t`Show more`} hideLabel={t`Hide`}>
                                                <div dangerouslySetInnerHTML={{__html: category.description}}/>
                                            </Spoiler>
                                        </div>
                                    )}
                                    <div className={'hi-product-rows'}>
                                        {category.products?.length === 0 && (
                                            <div className={'hi-no-products'}>
                                                <p className={'hi-no-products-message'}>
                                                    {category.no_products_message || t`There are no products available in this category`}
                                                </p>
                                            </div>
                                        )}

                                        {(category.products) && category.products.map((product) => {
                                            const currentProductIndex = productIndex;
                                            const quantityRange = range(product.min_per_order || 1, product.max_per_order || 25)
                                                .map((n) => n.toString());
                                            quantityRange.unshift("0");

                                            const isProductCollapsed = props.productCards
                                                ? collapsibleCards && (collapsedProducts[Number(product.id)] ?? true)
                                                : collapsedProducts[Number(product.id)] ?? product.start_collapsed;
                                            const toggleCollapse = () => {
                                                setCollapsedProducts(prev => ({
                                                    ...prev,
                                                    [Number(product.id)]: !isProductCollapsed
                                                }));
                                            };

                                            const productSelectedQuantity = form.values.products?.[currentProductIndex]?.quantities
                                                ?.reduce((acc, {quantity}) => acc + Number(quantity), 0) || 0;
                                            const rowClassName = `hi-product-row ${product.is_highlighted ? 'hi-product-highlighted' : ''} ${productSelectedQuantity > 0 ? 'hi-product-selected' : ''}`;

                                            const highlightMessage = product.is_highlighted && product.highlight_message && (
                                                <div className={'hi-product-highlight-message'}>
                                                    {product.highlight_message}
                                                </div>
                                            );

                                            const pricing = (
                                                <div className={'hi-price-tiers-rows'}>
                                                    {product.type === ProductPriceType.Sized ? (
                                                        <SizedPricing
                                                            productIndex={productIndex++}
                                                            event={event}
                                                            product={product}
                                                            form={form}
                                                        />
                                                    ) : (
                                                        <TieredPricing
                                                            productIndex={productIndex++}
                                                            event={event}
                                                            product={product}
                                                            form={form}
                                                        />
                                                    )}
                                                </div>
                                            );

                                            const messages = (
                                                <>
                                                    {!!product.deposit_amount && product.deposit_amount > 0 && (
                                                        <div className={'hi-product-deposit-row'}>
                                                            <Trans>
                                                                + Security deposit of {formatCurrency(product.deposit_amount, event.currency)} per
                                                                unit, sent separately and returned after the event
                                                            </Trans>
                                                        </div>
                                                    )}

                                                    {product.max_per_order && form.values.products && isObjectEmpty(form.errors) && (form.values.products[currentProductIndex]?.quantities.reduce((acc, {quantity}) => acc + Number(quantity), 0) > product.max_per_order) && (
                                                        <div className={'hi-product-quantity-error'}>
                                                            <Trans>The maximum number of products
                                                                for {product.title}
                                                                is {product.max_per_order}</Trans>
                                                        </div>
                                                    )}

                                                    {form.errors[`products.${currentProductIndex}`] && (
                                                        <div className={'hi-product-quantity-error'}>
                                                            {form.errors[`products.${currentProductIndex}`]}
                                                        </div>
                                                    )}
                                                </>
                                            );

                                            const description = product.description && (
                                                <div
                                                    className={'hi-product-description-row'}>
                                                    <Spoiler maxHeight={87} showLabel={t`Show more`}
                                                             hideLabel={t`Hide`}>
                                                        <div dangerouslySetInnerHTML={{
                                                            __html: product.description
                                                        }}/>
                                                    </Spoiler>
                                                </div>
                                            );

                                            if (props.productCards) {
                                                // One price (or one for every size): beside the title, the row
                                                // below keeps only the note and the quantity.
                                                const singlePrice = product.type === ProductPriceType.Sized
                                                    || (product.type !== ProductPriceType.Donation && product.prices?.length === 1);
                                                // Sizes keep their rows (the heading, then one line per size, its label
                                                // shown); a lone price fits the note and the quantity on one line.
                                                const singleRow = singlePrice && product.type !== ProductPriceType.Sized;
                                                const count = product.quantity_available;
                                                const spotsLeft = product.is_available && !!count && count !== Constants.INFINITE_TICKETS;
                                                const price = product.prices?.[0];
                                                const feesExcluded = singlePrice && !!price
                                                    && event.settings?.price_display_mode !== 'INCLUSIVE'
                                                    && (price.tax_total || 0) + (price.fee_total || 0) > 0;
                                                // Closed, a product with several prices shows their range.
                                                const headPrice = (singlePrice || isProductCollapsed) && cardPriceLabel(product, event);

                                                // Bottom left of the open card, beside the quantity.
                                                const notes = (
                                                    <>
                                                        {spotsLeft && (
                                                            <span className={'hi-product-availability'}>{t`Only ${count} spots left`}</span>
                                                        )}
                                                        {feesExcluded && (
                                                            <span className={'hi-product-fees-note'}>
                                                                {product.taxes?.some((tax) => tax.type === TaxAndFeeType.Tax) ? t`+ taxes and fees` : t`+ service fees`}
                                                            </span>
                                                        )}
                                                        {(!product.is_available && hasMultiplePrices(product)) && (
                                                            <ProductAvailabilityMessage product={product} event={event}/>
                                                        )}
                                                    </>
                                                );

                                                // The whole top opens and closes the card, but for its own links and
                                                // buttons (the description's, « Show more »); the title is the button.
                                                const onHeadClick = (clickEvent: React.MouseEvent) => {
                                                    const target = clickEvent.target as Element;
                                                    if (collapsibleCards && !target.closest('a, button:not(.hi-product-toggle)')) {
                                                        toggleCollapse();
                                                    }
                                                };

                                                return (
                                                    <div key={product.id}
                                                         className={classNames(rowClassName, {
                                                             'hi-product-collapsed': isProductCollapsed,
                                                             'hi-product-unavailable': !product.is_available,
                                                         })}
                                                         data-rough="stroke">
                                                        {highlightMessage}
                                                        <div className={collapsibleCards ? 'hi-product-head hi-product-head-toggle' : 'hi-product-head'}
                                                             onClick={onHeadClick}>
                                                            <div className={'hi-product-text'}>
                                                                <h3>
                                                                    {collapsibleCards ? (
                                                                        <button type={'button'} className={'hi-product-toggle'}
                                                                                aria-expanded={!isProductCollapsed}>
                                                                            {product.title}
                                                                        </button>
                                                                    ) : product.title}
                                                                </h3>
                                                                {isProductCollapsed && product.description ? (
                                                                    <div className={'hi-product-description-short'}
                                                                         dangerouslySetInnerHTML={{__html: product.description}}/>
                                                                ) : description}
                                                            </div>
                                                            {(headPrice || collapsibleCards) && (
                                                                <span className={'hi-product-head-side'}>
                                                                    {headPrice && <span className={'hi-product-head-price'}>{headPrice}</span>}
                                                                    {collapsibleCards && (
                                                                        <PublicIcon name={'chevron'} size={18}
                                                                                    className={'hi-product-chevron'}/>
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {!isProductCollapsed && (
                                                            <div className={singleRow ? 'hi-product-content hi-product-content-single' : 'hi-product-content'}>
                                                                {singleRow ? <>{notes}{pricing}</> : <>{pricing}{notes}</>}
                                                            </div>
                                                        )}
                                                        {!isProductCollapsed && messages}
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={product.id} className={rowClassName} data-rough="stroke">
                                                    {highlightMessage}
                                                    <div className={'hi-title-row'}>
                                                        <UnstyledButton variant={'transparent'}
                                                                        className={'hi-product-title'}
                                                                        onClick={toggleCollapse}
                                                        >
                                                            <h3>
                                                                {product.title}
                                                            </h3>
                                                            <div className={'hi-product-title-metadata'}>
                                                                {(product.is_available && !!product.quantity_available) && (
                                                                    <span className={'hi-product-availability'}>
                                                                        {product.quantity_available === Constants.INFINITE_TICKETS && (
                                                                            <Trans>
                                                                                Unlimited available
                                                                            </Trans>
                                                                        )}
                                                                        {product.quantity_available !== Constants.INFINITE_TICKETS && (
                                                                            <Trans>
                                                                                {product.quantity_available} available
                                                                            </Trans>
                                                                        )}
                                                                    </span>
                                                                )}

                                                                {(!product.is_available && hasMultiplePrices(product)) && (
                                                                    <ProductAvailabilityMessage product={product}
                                                                                                event={event}/>
                                                                )}

                                                                <span className={`hi-product-collapse-arrow`}>
                                                                <IconChevronRight
                                                                    className={isProductCollapsed ? "" : "open"}/>
                                                                </span>
                                                            </div>
                                                        </UnstyledButton>
                                                    </div>
                                                    <Collapse transitionDuration={100} in={!isProductCollapsed}
                                                              className={'hi-product-content'} hidden={isProductCollapsed}>
                                                        {pricing}
                                                        {messages}
                                                        {description}
                                                    </Collapse>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {(event?.has_promo_codes !== false || form.values.promo_code) && <div className={'hi-promo-code-row'}>
                        {form.values.promo_code ? (
                            <div className={'hi-promo-code-applied'}>
                                <span><b>{form.values.promo_code}</b> {t`applied`}</span>
                                <ActionIcon
                                    className={'hi-promo-code-applied-remove-icon-button'}
                                    variant="transparent"
                                    aria-label={t`remove`}
                                    title={t`Remove`}
                                    onClick={() => {
                                        promoCodeEventRefetchMutation.mutate(null)
                                    }}
                                >
                                    <IconX stroke={1.5} size={20}/>
                                </ActionIcon>
                            </div>
                        ) : (
                            <>
                                {promoCodeOpen ? (
                                    <label className={'hi-promo-code-label'} htmlFor={'hi-promo-code-input'}>
                                        <IconTag stroke={1.5} size={18}/>
                                        {t`Have a promo code?`}
                                    </label>
                                ) : (
                                    <button type={'button'}
                                            className={'hi-promo-code-label hi-promo-code-toggle'}
                                            aria-expanded={false}
                                            onClick={() => setPromoCodeOpen(true)}>
                                        <IconTag stroke={1.5} size={18}/>
                                        {t`Have a promo code?`}
                                    </button>
                                )}
                                {promoCodeOpen && <Group className={'hi-promo-code-input-wrapper'} wrap={'nowrap'} gap={'20px'}>
                                    {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                                    {/*@ts-ignore*/}
                                    <TextInput id={'hi-promo-code-input'}
                                               className={'hi-promo-code-input-field'}
                                               classNames={{input: 'hi-promo-code-input'}}
                                               placeholder={t`Enter your code`}
                                               onKeyDown={(event) => {
                                                   if (event.key === 'Enter') {
                                                       event.preventDefault();
                                                       handleApplyPromoCode();
                                                   }
                                               }} mb={0} ref={promoRef}/>
                                    <Button type={'button'}
                                            disabled={promoCodeEventRefetchMutation.isPending}
                                            loading={promoCodeEventRefetchMutation.isPending}
                                            className={'hi-apply-promo-code-button'} variant={'outline'}
                                            onClick={handleApplyPromoCode}>
                                        {t`Apply Promo Code`}
                                    </Button>
                                </Group>}
                            </>
                        )}
                    </div>}

                    {(productInfoMessage || hasProductInfoButton) && (
                        <div className={'hi-product-info-block'}>
                            {productInfoMessage && (
                                <div className={'hi-product-info-row'}>
                                    <ProductInfoIcon className={'hi-product-info-icon'} size={20} stroke={1.75}
                                                     aria-hidden="true"/>
                                    <div className={'hi-product-info-message'}
                                         dangerouslySetInnerHTML={{__html: productInfoMessage}}/>
                                </div>
                            )}
                            {hasProductInfoButton && (
                                <Button component={'a'}
                                        href={productInfoButtonUrl as string}
                                        target={'_blank'}
                                        rel={'noopener noreferrer'}
                                        className={'hi-product-info-button'}
                                        rightSection={<IconExternalLink stroke={1.5} size={16}/>}>
                                    {productInfoButtonText}
                                </Button>
                            )}
                        </div>
                    )}

                    <div className={'hi-footer-row'}>
                        {event?.settings?.product_page_message && (
                            <div dangerouslySetInnerHTML={{
                                __html: event.settings.product_page_message.replace(/\n/g, '<br/>')
                            }} className={'hi-product-page-message'}/>
                        )}
                        {props.showSubtotal && (
                            <div className={'hi-subtotal-row'}>
                                <div className={'hi-subtotal-label'}>
                                    <span className={'hi-subtotal-title'}>
                                        {t`Subtotal`} · {selectedProductQuantitySum === 1
                                            ? t`1 ticket`
                                            : t`${Number(selectedProductQuantitySum)} tickets`}
                                    </span>
                                    {selectedProductsSubtotal > 0 && (
                                        <span className={'hi-subtotal-note'}>{t`Fees calculated at the next step`}</span>
                                    )}
                                </div>
                                <span className={'hi-subtotal-amount'}>
                                    {formatCurrency(selectedProductsSubtotal, event.currency)}
                                </span>
                            </div>
                        )}
                        <Button disabled={isButtonDisabled} fullWidth className={'hi-continue-button'}
                                type={"submit"}
                                loading={productMutation.isPending}>
                            {props.continueButtonText || event?.settings?.continue_button_text || t`Continue`}
                        </Button>
                    </div>
                </form>
            )}

            {
                /**
                 * (c) Hi.Events Ltd 2025
                 *
                 * PLEASE NOTE:
                 *
                 * Hi.Events is licensed under the GNU Affero General Public License (AGPL) version 3.
                 *
                 * You can find the full license text at: https://github.com/HiEventsDev/hi.events/blob/main/LICENCE
                 *
                 * In accordance with Section 7(b) of the AGPL, we ask that you retain the "Powered by Hi.Events" notice.
                 *
                 * If you wish to remove this notice, a commercial license is available at: https://hi.events/licensing
                 */
            }
            {(props.showPoweredBy ?? true) && (
                <PoweredByFooter style={{
                    'color': props.colors?.primaryText || '#000',
                }}/>
            )}
        </div>
    );
}

export default SelectProducts;
