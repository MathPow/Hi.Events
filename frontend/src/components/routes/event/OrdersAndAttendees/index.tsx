import {ReactNode} from "react";
import {Button, Skeleton} from "@mantine/core";
import {useMediaQuery} from "@mantine/hooks";
import classNames from "classnames";
import {NavLink, useLocation, useParams} from "react-router";
import {t} from "@lingui/macro";
import {useGetEvent} from "../../../../queries/useGetEvent.ts";
import {useGetEventStats} from "../../../../queries/useGetEventStats.ts";
import {useGetEventOrders} from "../../../../queries/useGetEventOrders.ts";
import {useGetAttendees} from "../../../../queries/useGetAttendees.ts";
import {usePageDetail} from "../../../layouts/AppLayout/PageStatus.tsx";
import {PageBody} from "../../../common/PageBody";
import {PageTitle} from "../../../common/PageTitle";
import {SearchInput} from "../../../common/EventFilters";
import {SkeletonCircle, SkeletonLine, SkeletonPill} from "../../../common/Skeletons";
import {OrdersTab} from "./OrdersTab.tsx";
import {AttendeesTab} from "./AttendeesTab.tsx";
import {FilterButton, ICONS} from "./filters.tsx";
import classes from "./OrdersAndAttendees.module.scss";

export type Section = 'orders' | 'attendees';

/** A box of the « Infos » row (Figma 550:3087): round icon, big number, label, an orange detail. */
export const InfoTile = ({icon, tone, value, label, detail, loading = false}: {
    icon: string,
    tone: 'green' | 'orange' | 'neutral' | 'blue' | 'yellow',
    value: ReactNode,
    label: string,
    detail?: ReactNode,
    loading?: boolean,
}) => (
    <div className={classes.tile}>
        <span className={classes.tileIcon} data-tone={tone} aria-hidden>
            <img src={icon} width={20} height={20} alt=""/>
        </span>
        <div className={classes.tileText}>
            <span className={classes.tileValue}>
                {loading ? <span className={classes.tileValueSkeleton}><SkeletonLine width={96} height={24}/></span> : value}
            </span>
            <span className={classes.tileLabel}>{label}</span>
            {detail && <span className={classes.tileDetail}>{detail}</span>}
        </div>
    </div>
);

const ROWS = 8;

// The orders' table while they load: the real header, rows shaped like the orders.
export const OrderRowsSkeleton = () => (
    <>
        <div className={classNames(classes.orderGrid, classes.tableHead)}>
            <span>{t`Order`}</span>
            <span>{t`Customer`}</span>
            <span>{t`Contents`}</span>
            <span>{t`Amount`}</span>
            <span>{t`Status`}</span>
            <span/>
        </div>
        <div className={classes.list} aria-busy>
            {[...Array(ROWS)].map((_, index) => (
                <div key={index} className={classNames(classes.orderGrid, classes.row, classes.skeletonRow)}>
                    <span className={classes.orderCell}>
                        <SkeletonLine width={72} height={14}/>
                        <SkeletonLine width={96} height={10}/>
                    </span>
                    <span className={classes.personCell}>
                        <SkeletonCircle size={40}/>
                        <span className={classes.personText}>
                            <SkeletonLine width={[130, 110, 150][index % 3]} height={14}/>
                            <SkeletonLine width={[170, 150, 200][index % 3]} height={11}/>
                            <span className={classes.phoneOnly}><SkeletonPill width={76} height={22}/></span>
                        </span>
                    </span>
                    <span className={classes.contentsCell}><SkeletonLine width={['82%', '64%', '90%'][index % 3]} height={12}/></span>
                    <span className={classes.amountCell}><SkeletonLine width={index % 2 ? 48 : 60} height={14}/></span>
                    <span className={classes.statusCell}><SkeletonPill width={index % 2 ? 76 : 88} height={26}/></span>
                    <img src={`${ICONS}/chevron-droite.svg`} width={20} height={20} alt="" className={classes.chevronCell}/>
                </div>
            ))}
        </div>
    </>
);

// The attendees' table while they load.
export const AttendeeRowsSkeleton = () => (
    <>
        <div className={classNames(classes.attendeeGrid, classes.tableHead)}>
            <span>{t`Attendee`}</span>
            <span>{t`Ticket`}</span>
            <span>{t`Order`}</span>
            <span>{t`Bib`}</span>
            <span/>
        </div>
        <div className={classes.list} aria-busy>
            {[...Array(ROWS)].map((_, index) => (
                <div key={index} className={classNames(classes.attendeeGrid, classes.row, classes.skeletonRow)}>
                    <span className={classes.personText}>
                        <SkeletonLine width={[130, 110, 150][index % 3]} height={14}/>
                        <SkeletonLine width={[170, 150, 200][index % 3]} height={11}/>
                    </span>
                    <span className={classNames(classes.ticketCell, classes.desktopOnly)}>
                        <SkeletonLine width={['70%', '54%', '80%'][index % 3]} height={12}/>
                    </span>
                    <span className={classes.desktopOnly}><SkeletonLine width={64} height={12}/></span>
                    <span className={classes.desktopOnly}><SkeletonLine width={32} height={12}/></span>
                    <span className={classes.more} style={{display: 'grid', placeItems: 'center'}}>
                        <img src="/interface/admin/produits/actions.svg" width={20} height={20} alt=""/>
                    </span>
                </div>
            ))}
        </div>
    </>
);

// The page while the event loads: title, capsule and frames are real, the figures and rows wait.
const OrdersAndAttendeesSkeleton = ({section, capsule}: { section: Section, capsule: ReactNode }) => {
    const isMobile = useMediaQuery('(max-width: 767px)');
    const orders = section === 'orders';
    const exportButton = (
        <Button variant="outline" className={classes.desktopOnly} disabled
                leftSection={<img src={`${ICONS}/telecharger.svg`} width={20} height={20} alt=""/>}>
            {t`Export (CSV)`}
        </Button>
    );

    return (
        <>
            <PageTitle subheading={t`The orders and the attendees of this event.`} mobileSubheading={null}
                       actions={orders ? exportButton : (
                           <>
                               {exportButton}
                               <Button className={classes.desktopOnly} disabled
                                       leftSection={<img src="/interface/admin/produits/plus.svg" width={20} height={20} alt=""/>}>
                                   {t`Add an attendee`}
                               </Button>
                           </>
                       )}>
                {orders ? t`Orders` : t`Attendees`}
            </PageTitle>

            {capsule}

            <div className={classes.tiles}>
                {orders ? (
                    <>
                        <InfoTile loading icon={`${ICONS}/dollar.svg`} tone="green" label={t`Net sales`} value=""/>
                        <InfoTile loading icon="/interface/admin/produits/sac.svg" tone="orange" label={t`Average order`} value=""/>
                        <InfoTile loading icon={`${ICONS}/remboursement.svg`} tone="neutral" label={t`Refunds`} value=""/>
                    </>
                ) : (
                    <InfoTile loading icon={`${ICONS}/participants-20.svg`} tone="orange" label={t`Registered`} value=""/>
                )}
            </div>

            <div className={classes.toolbar}>
                <div className={classes.searchLine}>
                    {orders ? (
                        <SearchInput value="" onChange={() => undefined} compact={!!isMobile}
                                     placeholder={isMobile ? t`Name, email or no.` : t`Search a name, an email or an order number`}
                                     label={t`Search orders`}/>
                    ) : (
                        <SearchInput value="" onChange={() => undefined} compact={!!isMobile}
                                     placeholder={isMobile
                                         ? t`Name, email or bib`
                                         : t`Search a name, an email, an order number or a bib`}
                                     label={t`Search attendees`}/>
                    )}
                    <span className={classes.phoneOnly}><FilterButton active={false} onClick={() => undefined}/></span>
                </div>
                <div className={classes.desktopMenus}>
                    {orders && <Skeleton width={136} height={56} radius={16}/>}
                    <Skeleton width={orders ? 130 : 198} height={56} radius={16}/>
                </div>
            </div>

            {!orders && (
                <Button className={classNames(classes.phoneOnly, classes.addPhone)} fullWidth disabled
                        leftSection={<img src="/interface/admin/produits/plus.svg" width={20} height={20} alt=""/>}>
                    {t`Add an attendee`}
                </Button>
            )}

            <section className={classes.card}>
                {orders ? <OrderRowsSkeleton/> : <AttendeeRowsSkeleton/>}
            </section>
        </>
    );
};

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
                <OrdersAndAttendeesSkeleton section={section} capsule={capsule}/>
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
