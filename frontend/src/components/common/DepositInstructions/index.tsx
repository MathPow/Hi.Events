import {t, Trans} from "@lingui/macro";
import {Card} from "../Card";
import {Event, Order} from "../../../types.ts";
import {formatCurrency} from "../../../utilites/currency.ts";

interface DepositInstructionsProps {
    event: Event;
    order: Order;
}

export const DepositInstructions = ({event, order}: DepositInstructionsProps) => {
    if (!order.deposit_amount || order.deposit_amount <= 0) {
        return null;
    }

    return (
        <div style={{marginTop: '20px', marginBottom: '40px'}}>
            <h2>{t`Security Deposit`}</h2>
            <Card>
                <p style={{marginTop: 0}}>
                    <Trans>
                        A security deposit of <b>{formatCurrency(order.deposit_amount, event.currency)}</b> must be
                        sent separately. It is not included in your order total.
                    </Trans>
                </p>
                {!!event?.settings?.deposit_instructions && (
                    <div dangerouslySetInnerHTML={{__html: event.settings.deposit_instructions}}/>
                )}
            </Card>
        </div>
    );
};
