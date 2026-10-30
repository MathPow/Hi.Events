import {Link} from "react-router";
import {t} from "@lingui/macro";
import {intlLocale} from "../../../../utilites/intlLocale.ts";
import dayjs from "dayjs";
import classes from './EventCard.module.scss';
import {Event, EventLifecycleStatus, Product, ProductType} from "../../../../types.ts";
import {eventHomepagePath} from "../../../../utilites/urlHelper.ts";
import {getProductsFromEvent} from "../../../../utilites/helpers.ts";
import {PublicIcon} from "../../../common/PublicIcon";
import {useCardHover} from "../../../../hooks/useCardHover.ts";

interface EventCardProps {
    event: Event;
    // Plus petite, l'organisateur au-dessus du titre, sans horaire ni lieu, et seule la photo
    // bouge au survol (« Decouvrir des evenements » de Mes billets).
    compact?: boolean;
}

// En dessous de ce nombre, on annonce les places restantes (quand l'organisateur les affiche).
const PEU_DE_PLACES = 10;

const formatMoney = (value: number, currency: string) =>
    new Intl.NumberFormat(intlLocale(), {style: 'currency', currency, minimumFractionDigits: 2}).format(value);

const formatDate = (date: string, timeZone: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(intlLocale(), {...options, timeZone}).format(new Date(date));

const sameDay = (a: string, b: string, timeZone: string) => {
    const day = new Intl.DateTimeFormat('en-CA', {timeZone, year: 'numeric', month: '2-digit', day: '2-digit'});
    return day.format(new Date(a)) === day.format(new Date(b));
};

// « 10 h 00 »; dans un intervalle, les heures piles s'abregent (« 18 h → sam. 16 h »).
const formatTime = (date: string, timeZone: string, abbreviate: boolean) => {
    const onTheHour = new Intl.DateTimeFormat('en', {minute: 'numeric', timeZone}).format(new Date(date)) === '0';
    return formatDate(date, timeZone, abbreviate && onTheHour ? {hour: 'numeric'} : {hour: 'numeric', minute: '2-digit'});
};

const formatSchedule = (event: Event) => {
    const {start_date: start, end_date: end, timezone} = event;
    if (!end) {
        return formatTime(start, timezone, false);
    }
    const endLabel = sameDay(start, end, timezone)
        ? formatTime(end, timezone, true)
        : `${formatDate(end, timezone, {weekday: 'short'})} ${formatTime(end, timezone, true)}`;

    return `${formatTime(start, timezone, true)} → ${endLabel}`;
};

const formatPrice = (event: Event, products: Product[]) => {
    const prices = products.flatMap(product => product.prices?.length
        ? product.prices.map(price => price.price || 0)
        : [product.price || 0]);

    if (prices.length === 0) {
        return null;
    }

    const lowest = Math.min(...prices);
    const highest = Math.max(...prices);

    if (highest === 0) {
        return t`Free`;
    }

    return lowest === highest
        ? formatMoney(lowest, event.currency)
        : `${formatMoney(lowest, event.currency)} - ${formatMoney(highest, event.currency)}`;
};

// La pastille de rarete: seulement ce que l'API publique dit deja (complet, ou le nombre de
// places restantes quand l'organisateur a choisi de l'afficher sur tous ses billets en vente).
const scarcityLabel = (event: Event, products: Product[]) => {
    if (event.lifecycle_status === EventLifecycleStatus.ENDED) {
        return null;
    }

    const tickets = products.filter(product => product.product_type === ProductType.Ticket);
    const list = tickets.length > 0 ? tickets : products;

    if (list.length === 0) {
        return null;
    }

    if (list.every(product => product.is_sold_out)) {
        return t`Sold out`;
    }

    const onSale = list.filter(product => !product.is_sold_out);
    if (onSale.every(product => typeof product.quantity_available === 'number')) {
        const count = onSale.reduce((total, product) => total + (product.quantity_available as number), 0);
        if (count > 0 && count <= PEU_DE_PLACES) {
            return count === 1 ? t`Only 1 spot left` : t`Only ${count} spots left`;
        }
    }

    return null;
};

export const EventCard = ({event, compact = false}: EventCardProps) => {
    const coverImage = event.images?.find(img => img.type === 'EVENT_COVER');
    const location = event.settings?.location_details?.city || event.settings?.location_details?.venue_name;
    const isOnlineEvent = event.settings?.is_online_event;
    const products = getProductsFromEvent(event) || [];
    const price = formatPrice(event, products);

    const startDate = dayjs(event.start_date);
    const endDate = event.end_date ? dayjs(event.end_date) : startDate.add(8, 'hour');
    const isLive = dayjs().isAfter(startDate) && dayjs().isBefore(endDate);
    const badge = isLive ? t`LIVE` : scarcityLabel(event, products);
    // Comme les cartes du site: la carte suit un peu le curseur, sa photo zoome et se decale.
    const {card, photo, handlers} = useCardHover<HTMLAnchorElement, HTMLImageElement>({moveCard: !compact});

    return (
        <Link ref={card} to={eventHomepagePath(event)} className={compact ? `${classes.card} ${classes.compact}` : classes.card}
              data-rough {...handlers}>
            <div className={classes.image} data-rough>
                {coverImage ? (
                    <img ref={photo} src={coverImage.url} alt="" loading="lazy"/>
                ) : (
                    <div className={classes.placeholder}>
                        <PublicIcon name={'calendrier'} size={44}/>
                    </div>
                )}
                <div className={classes.badges}>
                    <span className={classes.dateBadge}>
                        <PublicIcon name={'calendrier'} className={classes.icon}/>
                        {formatDate(event.start_date, event.timezone, {weekday: 'short', day: 'numeric', month: 'short'})}
                    </span>
                    {badge && <span className={classes.scarcityBadge}>{badge}</span>}
                </div>
            </div>

            <div className={classes.body}>
                {compact && event.organizer && <span className={classes.organizer}>{event.organizer.name}</span>}
                <h3 className={classes.title}>{event.title}</h3>
                {!compact && (
                    <p className={classes.line}>
                        <PublicIcon name={'horloge'} size={18} className={classes.icon}/>
                        <span>{formatSchedule(event)}</span>
                    </p>
                )}
                {!compact && (location || isOnlineEvent) && (
                    <p className={classes.line}>
                        <PublicIcon name={isOnlineEvent ? 'globe' : 'lieu'} size={18} className={classes.icon}/>
                        <span>{isOnlineEvent ? t`Online Event` : location}</span>
                    </p>
                )}
                <div className={classes.bottom}>
                    {price && (
                        <span className={classes.price}>
                            <PublicIcon name={'billet'} className={classes.icon}/>
                            {price}
                        </span>
                    )}
                    <span className={classes.arrow} data-rough="button" aria-hidden>
                        <PublicIcon name={'fleche'} size={20}/>
                    </span>
                </div>
            </div>
        </Link>
    );
};
