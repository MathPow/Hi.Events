import {ReactNode} from "react";
import {t} from "@lingui/macro";
import classes from "./CheckoutColumns.module.scss";

// Les classes partagees par les etapes de la caisse (grilles de champs, sous-cartes, bouton principal).
export {classes as checkoutClasses};

// La caisse en deux colonnes de la maquette: le formulaire a gauche, « Votre commande » a droite,
// collante. Sous lg, une seule colonne: la commande, repliable, passe au-dessus du formulaire.
export const CheckoutColumns = ({panel, children}: { panel: ReactNode, children: ReactNode }) => (
    <div className={classes.columns}>
        <div className={classes.panel}>{panel}</div>
        <div className={classes.formCard}>
            <h1 className={classes.title}>{t({message: 'Checkout', context: 'checkout page title'})}</h1>
            {children}
        </div>
    </div>
);

interface CheckoutSectionProps {
    number: number;
    title: string;
    subtitle?: ReactNode;
    children?: ReactNode;
}

// Une etape numerotee du formulaire (« 1 Vos coordonnees », « 2 Participants », « 3 Paiement »).
export const CheckoutSection = ({number, title, subtitle, children}: CheckoutSectionProps) => (
    <section className={classes.section}>
        <header className={classes.sectionHeader}>
            <span className={classes.sectionNumber} aria-hidden>{number}</span>
            <div className={classes.sectionText}>
                <h2 className={classes.sectionTitle}>{title}</h2>
                {subtitle && <p className={classes.sectionSubtitle}>{subtitle}</p>}
            </div>
        </header>
        {children}
    </section>
);

// Le bouton de l'etape et sa mention, au bas du formulaire. Sur telephone, une barre collee
// au bas de l'ecran: le bouton reste a portee de pouce dans un long formulaire.
export const CheckoutActions = ({children}: { children: ReactNode }) => (
    <div className={classes.actions}>{children}</div>
);
