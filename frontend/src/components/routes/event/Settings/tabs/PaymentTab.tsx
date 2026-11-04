import {Link} from "react-router";
import {t} from "@lingui/macro";
import {Event, EventSettings, IdParam} from "../../../../../types.ts";
import {useGetAccount} from "../../../../../queries/useGetAccount.ts";
import {PaymentMethodsCard} from "../cards/PaymentMethodsCard.tsx";
import {FeesCard} from "../cards/FeesCard.tsx";
import {DepositsCard} from "../cards/DepositsCard.tsx";
import {InvoicingCard} from "../cards/InvoicingCard.tsx";
import {fieldIcon} from "../fieldParts.tsx";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

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
            <div className={`${classes.full} ${extra.feesRow}`}>
                {account && <FeesCard eventId={eventId} event={event} settings={settings} account={account}/>}
                <div className={extra.methodsColumn}>
                    <PaymentMethodsCard eventId={eventId} event={event} settings={settings}/>
                    <Link className={extra.linkCard} to={`/manage/organizer/${event.organizer?.id}/settings/taxes`}>
                        <span className={extra.linkCardIcon}>{fieldIcon('recu-20')}</span>
                        <span className={classes.toggleText}>
                            <span className={classes.toggleLabel}>{t`Taxes and additional fees`}</span>
                            <span className={classes.toggleHint}>{t`GST, QST and other fees, applied to this event.`}</span>
                        </span>
                        {fieldIcon('fleche-droite')}
                    </Link>
                </div>
            </div>
            <DepositsCard eventId={eventId} settings={settings}/>
            <InvoicingCard eventId={eventId} settings={settings}/>
        </div>
    );
};
