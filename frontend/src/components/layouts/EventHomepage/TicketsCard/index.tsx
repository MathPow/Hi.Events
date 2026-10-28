import {forwardRef, useEffect, useRef} from "react";
import {useMergedRef} from "@mantine/hooks";
import {t} from "@lingui/macro";
import SelectProducts, {ProductSelectionSummary} from "../../../routes/product-widget/SelectProducts";
import {PublicIcon} from "../../../common/PublicIcon";
import {Event, ProductPriceType} from "../../../../types.ts";
import {Constants} from "../../../../constants.ts";
import classes from "./TicketsCard.module.scss";

const SCREEN_MARGIN = 24;
// Sur un ecran tres bas, la carte garde de quoi montrer un billet et Continuer.
const MIN_HEIGHT = 360;

interface TicketsCardProps {
    event: Event;
    promoCodeValid?: boolean;
    promoCode?: string;
    formId: string;
    onSelectionChange: (summary: ProductSelectionSummary) => void;
    className?: string;
}

// La carte « Billets » de la page evenement: le widget de selection existant, habille comme la
// maquette (voir TicketsCard.module.scss), avec le sous-total et la mention du paiement. Avec
// plusieurs billets, ils commencent replies, leur prix a cote du titre. Sur grand ecran, la
// carte colle au defilement et s'arrete au bas de l'ecran: la liste des billets defile dedans.
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

    // Le bas de la carte suit le bas de l'ecran, qu'elle soit encore dans la page ou deja collee.
    useEffect(() => {
        const card = cardRef.current;
        if (!card) {
            return;
        }
        let frame = 0;
        const measure = () => {
            frame = 0;
            const top = Math.max(SCREEN_MARGIN, card.getBoundingClientRect().top);
            const height = Math.max(MIN_HEIGHT, window.innerHeight - top - SCREEN_MARGIN);
            card.style.setProperty('--billets-max', `${Math.round(height)}px`);
        };
        const schedule = () => {
            frame ||= requestAnimationFrame(measure);
        };
        measure();
        window.addEventListener('scroll', schedule, {passive: true});
        window.addEventListener('resize', schedule);

        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
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
            data-rough
        >
            <div className={classes.header}>
                <h2 className={classes.title}>{t`Tickets`}</h2>
                {hasLimitedSpots && <span className={classes.pill} data-rough>{t`Limited spots`}</span>}
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
                    collapseProducts={products.length > 1}
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
