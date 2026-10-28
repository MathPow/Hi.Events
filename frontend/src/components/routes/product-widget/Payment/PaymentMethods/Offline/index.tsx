import {Event} from "../../../../../../types.ts";
import {t} from "@lingui/macro";
import classes from "../../Payment.module.scss";

interface OfflinePaymentMethodProps {
    event: Event;
}

export const OfflinePaymentMethod = ({event}: OfflinePaymentMethodProps) => {
    const eventSettings = event?.settings;

    return (
        <div className={classes.instructions}>
            <h3 className={classes.instructionsTitle}>{t`Payment Instructions`}</h3>
            <div
                className={classes.instructionsBody} data-rough
                dangerouslySetInnerHTML={{
                    __html: eventSettings?.offline_payment_instructions || "",
                }}
            />
        </div>
    );
};
