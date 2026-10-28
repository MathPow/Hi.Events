import {t} from "@lingui/macro";
import {Link} from "react-router";
import {Event, Organizer} from "../../../../../types.ts";
import {useGetOrganizerPublicEvents} from "../../../../../queries/useGetOrganizerEventsPublic.ts";
import {eventCoverImageUrl, eventHomepagePath, organizerHomepagePath} from "../../../../../utilites/urlHelper.ts";
import {getProductsFromEvent} from "../../../../../utilites/helpers.ts";
import {formatCurrency} from "../../../../../utilites/currency.ts";
import {PublicIcon} from "../../../../common/PublicIcon";
import {shortDayLabel, shortTimeLabel} from "../confirmationDates.ts";
import classes from "./OtherEvents.module.scss";

const priceLabel = (event: Event): string | null => {
    const prices = (getProductsFromEvent(event) || []).flatMap((product) => (
        product.prices && product.prices.length > 0
            ? product.prices.map((price) => price.price || 0)
            : [product.price || 0]
    ));

    if (prices.length === 0) {
        return null;
    }

    const lowest = Math.min(...prices);
    const highest = Math.max(...prices);

    if (highest === 0) {
        return t`Free`;
    }

    return lowest === highest
        ? formatCurrency(lowest, event.currency)
        : `${formatCurrency(lowest, event.currency)} - ${formatCurrency(highest, event.currency)}`;
};

const OtherEventCard = ({event}: { event: Event }) => {
    const cover = eventCoverImageUrl(event);
    const price = priceLabel(event);
    const when = `${shortDayLabel(event.start_date, event.timezone)} · ${shortTimeLabel(event.start_date, event.timezone)}`;

    return (
        <Link to={eventHomepagePath(event)} className={classes.card} data-rough>
            {cover ? (
                <img className={classes.cover} data-rough src={cover} alt="" loading="lazy"/>
            ) : (
                <span className={`${classes.cover} ${classes.coverPlaceholder}`} data-rough aria-hidden>
                    <PublicIcon name={'calendrier'} size={28}/>
                </span>
            )}
            <span className={classes.text}>
                <span className={classes.title}>{event.title}</span>
                <span className={classes.when}>
                    {when}
                    {price && <span className={classes.priceInline}> · {price}</span>}
                </span>
                {price && (
                    <span className={classes.pricePill} data-rough>
                        <PublicIcon name={'billet'} size={16} className={classes.accentIcon}/>
                        {price}
                    </span>
                )}
            </span>
            <span className={classes.go} data-rough aria-hidden>
                <PublicIcon name={'fleche'} size={20}/>
            </span>
            <PublicIcon name={'chevron-droite'} size={18} className={classes.chevron}/>
        </Link>
    );
};

// Les prochaines sorties du meme organisateur, tirees de la liste publique de ses evenements a venir.
export const OtherEvents = ({organizer, currentEventId}: { organizer: Organizer, currentEventId: Event['id'] }) => {
    const {data} = useGetOrganizerPublicEvents(organizer.id, {
        pageNumber: 1,
        perPage: 3,
        sortBy: 'start_date',
        sortDirection: 'asc',
        additionalParams: {eventsStatus: 'upcoming'},
        filterFields: {},
    }, {enabled: !!organizer.id});

    const events = (data?.data || [])
        .filter((event) => String(event.id) !== String(currentEventId))
        .slice(0, 2);

    if (events.length === 0) {
        return null;
    }

    const organizerName = organizer.name;

    return (
        <section className={classes.section} data-rough>
            <div className={classes.header}>
                <h2 className={classes.heading}>{t`Other outings by ${organizerName}`}</h2>
                {organizer.slug && (
                    <Link to={organizerHomepagePath(organizer)} className={classes.viewAll}>
                        {t`View all`}
                        <PublicIcon name={'fleche'} size={16}/>
                    </Link>
                )}
            </div>
            <div className={classes.grid}>
                {events.map((event) => <OtherEventCard key={event.id} event={event}/>)}
            </div>
        </section>
    );
};
