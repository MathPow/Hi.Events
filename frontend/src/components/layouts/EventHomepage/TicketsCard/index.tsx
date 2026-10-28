import {CSSProperties, forwardRef, useEffect, useRef, useState} from "react";
import {useMergedRef} from "@mantine/hooks";
import {t} from "@lingui/macro";
import SelectProducts, {ProductSelectionSummary} from "../../../routes/product-widget/SelectProducts";
import {PublicIcon} from "../../../common/PublicIcon";
import {Event, ProductPriceType} from "../../../../types.ts";
import {Constants} from "../../../../constants.ts";
import classes from "./TicketsCard.module.scss";

const STICKY_MARGIN = 24;

interface TicketsCardProps {
    event: Event;
    promoCodeValid?: boolean;
    promoCode?: string;
    formId: string;
    onSelectionChange: (summary: ProductSelectionSummary) => void;
    className?: string;
}

// La carte « Billets » de la page evenement: le widget de selection existant, habille comme la
// maquette (voir TicketsCard.module.scss), avec le sous-total et la mention du paiement.
export const TicketsCard = forwardRef<HTMLElement, TicketsCardProps>(({
                                                                          event,
                                                                          promoCodeValid,
                                                                          promoCode,
                                                                          formId,
                                                                          onSelectionChange,
                                                                          className,
                                                                      }, ref) => {
    const cardRef = useRef<HTMLElement>(null);
    const mergedRef = useMergedRef(ref, cardRef);
    const [stickyTop, setStickyTop] = useState(STICKY_MARGIN);

    // Plus haute que l'ecran, la carte defile avec la page puis colle par le bas, pour que
    // Continuer reste a portee.
    useEffect(() => {
        const card = cardRef.current;
        if (!card) {
            return;
        }
        const measure = () => setStickyTop(Math.min(STICKY_MARGIN, window.innerHeight - card.offsetHeight - STICKY_MARGIN));
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(card);
        window.addEventListener('resize', measure);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, []);

    const products = event.product_categories?.flatMap(category => category.products || []) || [];

    const hasLimitedSpots = products.some(product => product.is_available
        && !product.is_sold_out
        && !!product.quantity_available
        && product.quantity_available !== Constants.INFINITE_TICKETS);

    const hasPaidProducts = products.some(product => product.type === ProductPriceType.Donation
        || product.prices?.some(price => Number(price.price) > 0));
    const paysWithStripe = hasPaidProducts && !!event.settings?.payment_providers?.includes('STRIPE');

    return (
        <section
            ref={mergedRef}
            id="tickets"
            className={className ? `${classes.card} ${className}` : classes.card}
            style={{'--billets-haut': `${stickyTop}px`} as CSSProperties}
        >
            <div className={classes.header}>
                <h2 className={classes.title}>{t`Tickets`}</h2>
                {hasLimitedSpots && <span className={classes.pill}>{t`Limited spots`}</span>}
            </div>

            <div className={classes.widget}>
                <SelectProducts
                    event={event}
                    promoCodeValid={promoCodeValid}
                    promoCode={promoCode}
                    formId={formId}
                    onSelectionChange={onSelectionChange}
                    showSubtotal
                    collapsiblePromoCode
                    colors={{
                        background: 'transparent',
                        primary: 'var(--dehors-brun)',
                        primaryText: 'var(--dehors-brun)',
                        secondary: 'var(--public-accent)',
                        secondaryText: 'var(--public-sur-accent)',
                        bodyBackground: 'var(--dehors-creme)',
                    }}
                    continueButtonText={event.settings?.continue_button_text}
                    padding={'0px'}
                    showPoweredBy={false}
                />
            </div>

            {paysWithStripe && (
                <p className={classes.secure}>
                    <PublicIcon name={'cadenas'} size={16}/>
                    {t`Secure payment by Stripe`}
                </p>
            )}
        </section>
    );
});

TicketsCard.displayName = 'TicketsCard';
