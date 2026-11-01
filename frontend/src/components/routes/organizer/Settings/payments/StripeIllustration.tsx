import {ReactNode} from "react";
import {t} from "@lingui/macro";
import {useRoughEdge} from "../../../../../hooks/useRoughEdge.ts";
import classes from "./StripeIllustration.module.scss";

/**
 * Figma « Admin · Paramètres · Paiements »: the Stripe card of the landing page (« Ton compte, ton
 * argent. »), small, before and after the connection; the status under it.
 */
export const StripeIllustration = ({status}: { status: ReactNode }) => {
    const card = useRoughEdge<HTMLDivElement>({amplitude: 1, step: 36});
    const under = useRoughEdge<HTMLDivElement>({amplitude: 1, step: 36});

    return (
        <div className={classes.box}>
            <div className={classes.stack} aria-hidden>
                <div ref={under} className={classes.under}/>
                <div ref={card} className={classes.card}>
                    <span className={classes.title}>{t`Your account, your money.`}</span>
                    <span className={classes.chip}/>
                    <span className={classes.bottom}>
                        <span>{t`Free to open, no subscription`}</span>
                        <span className={classes.logo}/>
                    </span>
                </div>
            </div>
            {status}
        </div>
    );
};
