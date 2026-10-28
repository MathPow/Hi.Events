import React from "react";
import {t, Trans} from "@lingui/macro";
import {Countdown} from "../../../common/Countdown";
import {PublicIcon} from "../../../common/PublicIcon";
import classes from "./CheckoutTopBar.module.scss";

interface CheckoutTopBarProps {
    onBack: (event: React.MouseEvent) => void;
    // La fin de la reservation des billets, tant que la commande est reservee.
    reservedUntil?: string;
    onExpiry: () => void;
    isMobile: boolean;
}

// Le haut de la caisse: « Retour a l'evenement » et le minuteur de la reservation.
export const CheckoutTopBar = ({onBack, reservedUntil, onExpiry, isMobile}: CheckoutTopBarProps) => {
    const countdown = reservedUntil && (
        <Countdown
            displayType={'short'}
            className={classes.countdown}
            closeToExpiryClassName={classes.countdownCloseToExpiry}
            targetDate={reservedUntil}
            onExpiry={onExpiry}
        />
    );

    return (
        <nav className={classes.bar}>
            <button type="button" className={classes.back} onClick={onBack}>
                <PublicIcon name={'retour'} size={16} className={classes.backIcon}/>
                <span className={classes.wide}>{t`Back to Event`}</span>
                <span className={classes.narrow}>{t`Event`}</span>
            </button>

            {countdown && (
                <div className={classes.timer} role="timer">
                    <PublicIcon name={'horloge'} size={16}/>
                    <span>
                        {isMobile
                            ? <Trans>Reserved · {countdown}</Trans>
                            : <Trans>Tickets reserved for {countdown}</Trans>}
                    </span>
                </div>
            )}
        </nav>
    );
};
