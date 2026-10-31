import {CSSProperties, useState} from "react";
import {t} from "@lingui/macro";
import {i18n} from "@lingui/core";
import {Slider} from "@mantine/core";
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

const SLIDER_CLASSES = {root: classes.feesSlider, thumb: classes.feesSliderThumb};

/**
 * What a sale of the chosen size costs in fees here and on Eventbrite, the
 * most used ticketing platform in Quebec.
 */
export const FeesComparator = () => {
    const [price, setPrice] = useState(30);
    const [tickets, setTickets] = useState(200);
    const locale = `${i18n.locale.split('-')[0]}-CA`;
    const money = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'CAD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
    const count = new Intl.NumberFormat(locale);
    const dehors = totalFees(DEHORS, price, tickets);
    const eventbrite = totalFees(EVENTBRITE, price, tickets);
    const saved = money.format(eventbrite - dehors);

    const settings = [
        {label: t`Ticket price`, shown: money.format(price), value: price, onChange: setPrice, min: 5, max: 200, step: 1},
        {label: t`Tickets sold`, shown: count.format(tickets), value: tickets, onChange: setTickets, min: 10, max: 1000, step: 10},
    ];
    const results = [
        {name: 'Billetterie Dehors', amount: dehors},
        {name: 'Eventbrite', amount: eventbrite},
    ];

    return (
        <div className={classes.feesCompare}>
            <span className={classes.eyebrow}>{t`Your fees, compared with Eventbrite`}</span>
            {settings.map(({label, shown, ...slider}) => (
                <div key={label} className={classes.feesSetting}>
                    <div className={classes.feesSettingHead}>
                        <span>{label}</span>
                        <strong>{shown}</strong>
                    </div>
                    <Slider {...slider} size="sm" thumbSize={22} label={null} thumbLabel={label}
                            thumbProps={{'aria-valuetext': shown}} classNames={SLIDER_CLASSES}/>
                </div>
            ))}
            <dl className={classes.feesResults}>
                {results.map(({name, amount}) => (
                    <div key={name} style={{'--share': amount / eventbrite} as CSSProperties}>
                        <dt>{name}</dt>
                        <dd>{money.format(amount)}</dd>
                    </div>
                ))}
            </dl>
            <strong className={classes.feesTotal}>{t`You keep ${saved} more.`}</strong>
        </div>
    );
};
