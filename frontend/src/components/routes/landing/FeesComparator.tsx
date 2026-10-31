import {CSSProperties, useState} from "react";
import {plural, t, Trans} from "@lingui/macro";
import {i18n} from "@lingui/core";
import {NumberInput} from "@mantine/core";
import classes from "./Landing.module.scss";

interface Rate {
    percent: number;
    // Per ticket, in dollars.
    fixed: number;
}

// One ticket per order, the fees included in its price. Ours: 2.5% plus
// Stripe's 2.9% + $0.30. Eventbrite's, from its Canadian help centre
// (October 2026): 3.5% + $1.29 plus 2.9% processing.
const DEHORS: Rate = {percent: 0.025 + 0.029, fixed: 0.3};
const EVENTBRITE: Rate = {percent: 0.035 + 0.029, fixed: 1.29};

const totalFees = ({percent, fixed}: Rate, price: number, tickets: number) => (price * percent + fixed) * tickets;

const FIELD_CLASSES = {root: classes.feesFieldRoot, input: classes.feesField};

/**
 * A blank of the sentence, as wide as what's typed in it.
 */
const Blank = ({label, value, onChange, max, prefix, suffix}: {
    label: string;
    value: number | string;
    onChange: (value: number | string) => void;
    max: number;
    prefix?: string;
    suffix?: string;
}) => (
    <NumberInput value={value} onChange={onChange} min={0} max={max} clampBehavior="strict"
                 allowNegative={false} allowDecimal={false} hideControls prefix={prefix} suffix={suffix}
                 inputMode="numeric" aria-label={label} classNames={FIELD_CLASSES}
                 style={{'--chars': `${value}`.length + (prefix ?? suffix ?? '').length} as CSSProperties}/>
);

/**
 * What a sale of the chosen size costs in fees here and on Eventbrite, the
 * most used ticketing platform in Quebec, on a ticket: the sale written in
 * a sentence to fill in, the fees on the stub.
 */
export const FeesComparator = () => {
    const [price, setPrice] = useState<number | string>(30);
    const [tickets, setTickets] = useState<number | string>(200);
    const locale = `${i18n.locale.split('-')[0]}-CA`;
    const money = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'CAD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
    // "$30" in English, "30 $" in French: the dollar sign on the side the language puts it.
    const parts = money.formatToParts(30);
    const sign = parts.find(part => part.type === 'currency')?.value ?? '$';
    const signFirst = parts[0]?.type === 'currency';

    const ticketPrice = Number(price) || 0;
    const ticketCount = Number(tickets) || 0;
    const dehors = totalFees(DEHORS, ticketPrice, ticketCount);
    const eventbrite = totalFees(EVENTBRITE, ticketPrice, ticketCount);
    const saved = money.format(eventbrite - dehors);
    const ticketsWorth = ticketPrice > 0 ? Math.floor((eventbrite - dehors) / ticketPrice) : 0;

    const ticketsField = <Blank label={t`Tickets sold`} value={tickets} onChange={setTickets} max={99999}/>;
    const priceField = <Blank label={t`Ticket price`} value={price} onChange={setPrice} max={9999}
                              prefix={signFirst ? sign : undefined} suffix={signFirst ? undefined : ` ${sign}`}/>;

    return (
        <div className={classes.feesCompare}>
            <div className={classes.feesTicketTop}>
                <div className={classes.feesSentence}>
                    <Trans>I sell {ticketsField} tickets at {priceField}.</Trans>
                </div>
            </div>
            <div className={classes.feesTicketStub}>
                <span className={classes.feesStubTitle}>{t`Your fees, compared with Eventbrite`}</span>
                <dl className={classes.feesReceipt}>
                    <div>
                        <dt>Billetterie Dehors</dt>
                        <dd>{money.format(dehors)}</dd>
                    </div>
                    <div>
                        <dt>Eventbrite</dt>
                        <dd>{money.format(eventbrite)}</dd>
                    </div>
                </dl>
                <p className={classes.feesStamp} aria-live="polite">
                    <strong>{t`You keep ${saved} more.`}</strong>
                    {ticketsWorth > 0 && (
                        <span>{plural(ticketsWorth, {
                            one: "That's the price of # ticket.",
                            other: "That's the price of # tickets.",
                        })}</span>
                    )}
                </p>
            </div>
        </div>
    );
};
