import {forwardRef, useEffect, useRef, useState} from "react";
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
// La duree du depliage du sous-total ($deplie dans TicketsCard.module.scss).
const UNFOLD_MS = 450;

interface TicketsCardProps {
    event: Event;
    promoCodeValid?: boolean;
    promoCode?: string;
    formId: string;
    onSelectionChange: (summary: ProductSelectionSummary) => void;
    ended?: boolean;
    className?: string;
}

// La carte « Billets » de la page evenement: le widget de selection existant, habille comme la
// maquette (voir TicketsCard.module.scss), avec le sous-total et la mention du paiement. Chaque
// billet est ouvert, son prix a cote du titre. Sur grand ecran, la carte colle au defilement et
// s'arrete au bas de l'ecran: la liste des billets defile dedans. Un evenement termine ne vend
// plus rien: la carte le dit a la place du widget. Le sous-total, Continuer et la mention
// Stripe restent replies jusqu'au premier billet choisi, puis se deplient et restent la.
export const TicketsCard = forwardRef<HTMLElement, TicketsCardProps>(({
                                                                          event,
                                                                          promoCodeValid,
                                                                          promoCode,
                                                                          formId,
                                                                          onSelectionChange,
                                                                          ended,
                                                                          className,
                                                                      }, ref) => {
    const cardRef = useRef<HTMLElement>(null);
    const mergedRef = useMergedRef(ref, cardRef);
    // opening: le depliage, contenu coupe; open: deplie, Continuer peut deborder (son survol grossit).
    const [unfold, setUnfold] = useState<'folded' | 'opening' | 'open'>('folded');

    useEffect(() => {
        if (unfold !== 'opening') {
            return;
        }
        const timer = window.setTimeout(() => setUnfold('open'), UNFOLD_MS);
        return () => window.clearTimeout(timer);
    }, [unfold]);

    const handleSelectionChange = (summary: ProductSelectionSummary) => {
        if (summary.quantity > 0) {
            setUnfold((current) => current === 'folded' ? 'opening' : current);
        }
        onSelectionChange(summary);
    };

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
            data-unfold={unfold}
        >
            <div className={classes.header}>
                <h2 className={classes.title}>{t`Tickets`}</h2>
                {hasLimitedSpots && !ended && <span className={classes.pill} data-rough>{t`Limited spots`}</span>}
            </div>

            {ended ? (
                <div className={classes.ended} data-rough>
                    <PublicIcon name={'horloge'} size={24}/>
                    <p>{t`This event has ended`}</p>
                </div>
            ) : (
                <>
                    <div className={classes.widget}>
                        <SelectProducts
                            event={event}
                            promoCodeValid={promoCodeValid}
                            promoCode={promoCode}
                            formId={formId}
                            onSelectionChange={handleSelectionChange}
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
                            productCards
                            padding={'0px'}
                            showPoweredBy={false}
                        />
                    </div>

                    {paysWithStripe && (
                        <div className={classes.secureUnfold}>
                            <p className={classes.secure}>
                                <PublicIcon name={'cadenas'} size={16}/>
                                {t`Secure payment by Stripe`}
                            </p>
                        </div>
                    )}
                </>
            )}
        </section>
    );
});

TicketsCard.displayName = 'TicketsCard';
