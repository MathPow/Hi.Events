import {ReactNode} from "react";
import classes from "./StripeIllustration.module.scss";

/**
 * Figma « Admin · Paramètres · Paiements »: the Stripe card of the landing page (« Ton compte, ton
 * argent. »), drawn in Figma and exported as one SVG so it scales as a whole; the status under it.
 */
export const StripeIllustration = ({status}: { status: ReactNode }) => (
    <div className={classes.box}>
        <img className={classes.card} src={'/interface/admin/carte-stripe.svg'} width={300} height={227}
             alt="" aria-hidden/>
        {status}
    </div>
);
