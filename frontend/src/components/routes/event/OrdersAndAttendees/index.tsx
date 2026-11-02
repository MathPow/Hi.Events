import {ReactNode} from "react";
import {NavLink, useLocation, useParams} from "react-router";
import {t} from "@lingui/macro";
import {useGetEvent} from "../../../../queries/useGetEvent.ts";
import {useGetEventStats} from "../../../../queries/useGetEventStats.ts";
import {useGetEventOrders} from "../../../../queries/useGetEventOrders.ts";
import {useGetAttendees} from "../../../../queries/useGetAttendees.ts";
import {usePageDetail} from "../../../layouts/AppLayout/PageStatus.tsx";
import {PageBody} from "../../../common/PageBody";
import {TableSkeleton} from "../../../common/TableSkeleton";
import {OrdersTab} from "./OrdersTab.tsx";
import {AttendeesTab} from "./AttendeesTab.tsx";
import {ICONS} from "./filters.tsx";
import classes from "./OrdersAndAttendees.module.scss";

export type Section = 'orders' | 'attendees';

/** A box of the « Infos » row (Figma 550:3087): round icon, big number, label, an orange detail. */
export const InfoTile = ({icon, tone, value, label, detail}: {
    icon: string,
    tone: 'green' | 'orange' | 'neutral' | 'blue' | 'yellow',
    value: ReactNode,
    label: string,
    detail?: ReactNode,
}) => (
    <div className={classes.tile}>
        <span className={classes.tileIcon} data-tone={tone} aria-hidden>
            <img src={icon} width={20} height={20} alt=""/>
        </span>
        <div className={classes.tileText}>
            <span className={classes.tileValue}>{value}</span>
            <span className={classes.tileLabel}>{label}</span>
            {detail && <span className={classes.tileDetail}>{detail}</span>}
        </div>
    </div>
);

/**
 * Figma « Admin · Événement · Commandes et participants » (546:2372, 546:2726; phone 546:3115,
 * 546:3259): one page for the orders and the attendees, a capsule to go from one to the other.
 * /orders and /attendees stay two addresses, the capsule links them.
 */
const OrdersAndAttendees = () => {
    const {eventId} = useParams();
    const {pathname} = useLocation();
    const section: Section = /\/attendees\/?$/.test(pathname) ? 'attendees' : 'orders';
    const {data: event} = useGetEvent(eventId);
    const {data: stats} = useGetEventStats(eventId);
    const ordersTotal = useGetEventOrders(eventId, {pageNumber: 1, perPage: 1}).data?.meta?.total;
    const attendeesTotal = useGetAttendees(eventId, {pageNumber: 1, perPage: 1}).data?.meta?.total;

    usePageDetail(section === 'attendees' ? t`Attendees` : null);

    const capsule = (
        <nav className={classes.capsule} aria-label={t`Orders and attendees`}>
            {([
                {key: 'orders', label: t`Orders`, icon: 'recu', count: ordersTotal},
                {key: 'attendees', label: t`Attendees`, icon: 'participants', count: attendeesTotal},
            ] as const).map((item) => (
                <NavLink key={item.key} to={`../${item.key}`} relative="path" className={classes.capsuleLink}
                         aria-current={section === item.key ? 'page' : undefined}>
                    <span className={classes.capsuleIcon} aria-hidden
                          style={{['--icon' as string]: `url(${ICONS}/${item.icon}.svg)`}}/>
                    {item.label}
                    {item.count !== undefined && <span className={classes.capsuleCount}>{item.count}</span>}
                </NavLink>
            ))}
        </nav>
    );

    if (!event) {
        return (
            <PageBody>
                <TableSkeleton isVisible/>
            </PageBody>
        );
    }

    return (
        <PageBody>
            {section === 'orders'
                ? <OrdersTab event={event} stats={stats} capsule={capsule}/>
                : <AttendeesTab event={event} stats={stats} capsule={capsule}/>}
        </PageBody>
    );
};

export default OrdersAndAttendees;
