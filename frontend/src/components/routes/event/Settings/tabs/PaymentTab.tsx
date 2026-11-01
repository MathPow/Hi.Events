import {Event, EventSettings, IdParam} from "../../../../../types.ts";
import {useGetAccount} from "../../../../../queries/useGetAccount.ts";
import {PaymentMethodsCard} from "../cards/PaymentMethodsCard.tsx";
import {FeesCard} from "../cards/FeesCard.tsx";
import {DepositsCard} from "../cards/DepositsCard.tsx";
import {InvoicingCard} from "../cards/InvoicingCard.tsx";
import classes from "../../../organizer/Settings/Settings.module.scss";

interface TabProps {
    eventId: IdParam;
    event: Event;
    settings: EventSettings;
}

// « Paiement et facturation » (named in the help center): payment methods, fees, deposits and invoices.
export const PaymentTab = ({eventId, event, settings}: TabProps) => {
    const {data: account} = useGetAccount();

    return (
        <div className={classes.grid}>
            <PaymentMethodsCard eventId={eventId} event={event} settings={settings}/>
            {account && <FeesCard eventId={eventId} event={event} settings={settings} account={account}/>}
            <DepositsCard eventId={eventId} settings={settings}/>
            <InvoicingCard eventId={eventId} settings={settings}/>
        </div>
    );
};
