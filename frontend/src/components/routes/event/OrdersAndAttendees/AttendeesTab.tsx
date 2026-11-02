import {ReactNode, useEffect, useMemo, useState} from "react";
import {ActionIcon, Button, Menu, Skeleton, UnstyledButton} from "@mantine/core";
import {useDebouncedValue, useDisclosure, useMediaQuery} from "@mantine/hooks";
import {IconPencil, IconRepeat, IconTrash, IconUserCheck} from "@tabler/icons-react";
import {plural, t} from "@lingui/macro";
import classNames from "classnames";
import dayjs from "dayjs";
import {
    Attendee,
    Event,
    EventStats,
    IdParam,
    ProductPriceType,
    ProductType,
    QueryFilterOperator,
    QueryFilters,
} from "../../../../types.ts";
import {useGetAttendees} from "../../../../queries/useGetAttendees.ts";
import {attendeesClient} from "../../../../api/attendee.client.ts";
import {getProductsFromEvent} from "../../../../utilites/helpers.ts";
import {downloadBinary} from "../../../../utilites/download.ts";
import {showError, showSuccess} from "../../../../utilites/notifications.tsx";
import {confirmationDialog} from "../../../../utilites/confirmationDialog.tsx";
import {useModifyAttendee} from "../../../../mutations/useModifyAttendee.ts";
import {useResendAttendeeTicket} from "../../../../mutations/useResendAttendeeTicket.ts";
import {PageTitle} from "../../../common/PageTitle";
import {Pagination} from "../../../common/Pagination";
import {SearchInput} from "../../../common/EventFilters";
import {CreateAttendeeModal} from "../../../modals/CreateAttendeeModal";
import {ManageAttendeeModal} from "../../../modals/ManageAttendeeModal";
import {ManageOrderModal} from "../../../modals/ManageOrderModal";
import {CheckChoice, CheckMenu, FilterButton, FilterSheet, ICONS, SheetChips} from "./filters.tsx";
import {InfoTile} from "./index.tsx";
import classes from "./OrdersAndAttendees.module.scss";

const PER_PAGE = 10;
// eslint-disable-next-line lingui/no-unlocalized-strings
const PHONE = '(max-width: 767px)';

const plusIcon = <img src="/interface/admin/produits/plus.svg" width={20} height={20} alt=""/>;

export const AttendeesTab = ({event, stats, capsule}: { event: Event, stats?: EventStats, capsule: ReactNode }) => {
    const isMobile = useMediaQuery(PHONE);
    const [search, setSearch] = useState('');
    const [query] = useDebouncedValue(search.trim(), 300);
    const [tickets, setTickets] = useState<string[]>([]);
    const [page, setPage] = useState(1);
    const [shown, setShown] = useState(PER_PAGE);
    const [sheetOpen, sheet] = useDisclosure(false);
    const [createOpen, create] = useDisclosure(false);
    const [exporting, setExporting] = useState(false);
    const [editedId, setEditedId] = useState<IdParam>();
    const [orderId, setOrderId] = useState<IdParam>();
    const modifyMutation = useModifyAttendee();
    const resendMutation = useResendAttendeeTicket();

    useEffect(() => {
        setPage(1);
        setShown(PER_PAGE);
    }, [query, tickets]);

    const products = useMemo(() => getProductsFromEvent(event) ?? [], [event]);
    const ticketProducts = products.filter((product) => product.product_type === ProductType.Ticket);
    const merch = products.filter((product) => product.product_type === ProductType.General
        && product.type !== ProductPriceType.Donation);

    const filtersFor = (perPage: number, pageNumber = 1): QueryFilters => ({
        pageNumber,
        perPage,
        query: query || undefined,
        filterFields: tickets.length ? {product_id: {operator: QueryFilterOperator.In, value: tickets.join(',')}} : {},
    });

    const attendeesQuery = useGetAttendees(event.id, isMobile ? filtersFor(shown) : filtersFor(PER_PAGE, page));
    const bibsGiven = useGetAttendees(event.id, {
        pageNumber: 1,
        perPage: 1,
        filterFields: {bib_number: {operator: QueryFilterOperator.NotEquals, value: 'null'}},
    }).data?.meta?.total;

    const attendees = attendeesQuery.data?.data ?? [];
    const meta = attendeesQuery.data?.meta;
    const total = Number(meta?.total ?? 0);
    const lastPage = Number(meta?.last_page ?? 1);
    const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
    const to = Math.min(page * PER_PAGE, total);
    const filtered = !!query || tickets.length > 0;

    // « 112 / 120 Inscrits »: the capacity only when every ticket has a limit.
    const registered = Number(stats?.total_attendees_registered ?? 0);
    const capacity = ticketProducts.length > 0 && ticketProducts.every((product) => Number(product.initial_quantity_available) > 0)
        ? ticketProducts.reduce((sum, product) => sum + Number(product.initial_quantity_available), 0)
        : null;
    const remaining = capacity !== null ? Math.max(capacity - registered, 0) : null;

    // « Merch à remettre »: the products sold, by size when they have sizes (« S 4 · M 5 · L 3 »).
    const merchSold = merch.reduce((sum, product) => sum + Number(product.quantity_sold ?? 0), 0);
    const sizes = new Map<string, number>();
    merch.filter((product) => product.type === ProductPriceType.Sized).forEach((product) =>
        product.prices?.forEach((price) => {
            if (price.label && Number(price.quantity_sold) > 0) {
                sizes.set(price.label, (sizes.get(price.label) ?? 0) + Number(price.quantity_sold));
            }
        }));
    const sizesLine = [...sizes.entries()].map(([size, count]) => `${size} ${count}`).join(' · ');

    // « Dossards attribués »: only when a ticket gives bibs.
    const givesBibs = ticketProducts.some((product) => product.prices?.some((price) => price.bib_number_start != null));
    const toAssign = Math.max(registered - Number(bibsGiven ?? 0), 0);

    const ticketChoices: CheckChoice[] = ticketProducts.map((product) => ({
        value: String(product.id),
        label: product.title,
        count: Number(product.quantity_sold ?? 0),
    }));
    const selectedCount = tickets.length;
    const ticketsLabel = tickets.length === 0
        ? t`All tickets`
        : tickets.length === 1
            ? ticketProducts.find((product) => String(product.id) === tickets[0])?.title ?? t`All tickets`
            : plural(selectedCount, {one: '# ticket', other: '# tickets'});

    // « Forfait chandail · M », « Course en sentier · 10 km »: the option when the ticket has several.
    const ticketLabel = (attendee: Attendee) => {
        const product = products.find((candidate) => candidate.id === attendee.product_id);
        const price = (product?.prices?.length ?? 0) > 1
            ? product?.prices?.find((candidate) => candidate.id === attendee.product_price_id)
            : undefined;
        return [product?.title, price?.label].filter(Boolean).join(' · ');
    };

    const statusTag = (attendee: Attendee) => {
        if (attendee.status === 'CANCELLED') {
            return <span className={classes.tag} data-tone="neutral">{t({message: 'Cancelled', context: 'attendee status'})}</span>;
        }
        if (attendee.status === 'AWAITING_PAYMENT') {
            return <span className={classes.tag} data-tone="waiting">{t`Awaiting Payment`}</span>;
        }
        return null;
    };

    const resend = (attendee: Attendee) => resendMutation.mutate({attendeeId: attendee.id, eventId: event.id}, {
        onSuccess: () => showSuccess(t`Ticket email has been resent to attendee`),
        onError: (error: any) => showError(error.response?.data?.message || t`Failed to resend ticket email`),
    });

    const toggleCancel = (attendee: Attendee) => {
        const isCancelled = attendee.status === 'CANCELLED';
        confirmationDialog(isCancelled
            ? t`Are you sure you want to activate this attendee?`
            : t`Are you sure you want to cancel this attendee? This will void their ticket`, () => {
            modifyMutation.mutate({
                attendeeId: attendee.id,
                eventId: event.id,
                attendeeData: {status: isCancelled ? 'ACTIVE' : 'CANCELLED'},
            }, {
                onSuccess: () => showSuccess(isCancelled ? t`Ticket reactivated` : t`Ticket cancelled`),
                onError: () => showError(t`Failed to cancel attendee`),
            });
        });
    };

    const exportCsv = async () => {
        setExporting(true);
        try {
            const blob = await attendeesClient.export(event.id, 'csv');
            downloadBinary(blob, `participants-${dayjs().format('YYYY-MM-DD')}.csv`);
        } catch {
            showError(t`Failed to export attendees`);
        } finally {
            setExporting(false);
        }
    };

    const actions = (attendee: Attendee) => (
        <Menu shadow="md" width={230} position="bottom-end">
            <Menu.Target>
                <ActionIcon variant="subtle" className={classes.more} aria-label={t`Manage`}>
                    <img src="/interface/admin/produits/actions.svg" width={20} height={20} alt=""/>
                </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Item leftSection={<IconPencil size={14}/>} onClick={() => setEditedId(attendee.id)}>
                    {t`Edit`}
                </Menu.Item>
                <Menu.Item leftSection={<IconRepeat size={14}/>} onClick={() => resend(attendee)}>
                    {t`Resend ticket`}
                </Menu.Item>
                <Menu.Divider/>
                {attendee.status === 'CANCELLED' ? (
                    <Menu.Item leftSection={<IconUserCheck size={14}/>} onClick={() => toggleCancel(attendee)}>
                        {t`Reactivate`}
                    </Menu.Item>
                ) : (
                    <Menu.Item color="red" leftSection={<IconTrash size={14}/>} onClick={() => toggleCancel(attendee)}>
                        {t`Cancel`}
                    </Menu.Item>
                )}
            </Menu.Dropdown>
        </Menu>
    );

    return (
        <>
            <PageTitle
                subheading={t`The orders and the attendees of this event.`}
                mobileSubheading={null}
                actions={(
                    <>
                        <Button variant="outline" className={classes.desktopOnly} loading={exporting}
                                leftSection={<img src={`${ICONS}/telecharger.svg`} width={20} height={20} alt=""/>}
                                onClick={exportCsv}>
                            {t`Export (CSV)`}
                        </Button>
                        <Button className={classes.desktopOnly} leftSection={plusIcon} onClick={create.open}>
                            {t`Add an attendee`}
                        </Button>
                    </>
                )}
            >{t`Attendees`}</PageTitle>

            {capsule}

            <div className={classes.tiles}>
                <InfoTile icon={`${ICONS}/participants-20.svg`} tone="orange" label={t`Registered`}
                          value={capacity !== null ? `${registered} / ${capacity}` : registered}
                          detail={remaining !== null
                              ? plural(remaining, {one: '# spot left', other: '# spots left'})
                              : undefined}/>
                {merch.length > 0 && (
                    <InfoTile icon="/interface/admin/produits/chandail.svg" tone="blue" label={t`Merch to hand out`}
                              value={merchSold} detail={sizesLine || undefined}/>
                )}
                {givesBibs && (
                    <InfoTile icon={`${ICONS}/dossard.svg`} tone="yellow" label={t`Bibs assigned`}
                              value={bibsGiven ?? '—'}
                              detail={toAssign > 0 ? t`${toAssign} to assign` : undefined}/>
                )}
            </div>

            <div className={classes.toolbar}>
                <div className={classes.searchLine}>
                    <SearchInput value={search} onChange={setSearch} compact={!!isMobile}
                                 placeholder={isMobile
                                     ? t`Name, email or bib`
                                     : t`Search a name, an email, an order number or a bib`}
                                 label={t`Search attendees`}/>
                    <span className={classes.phoneOnly}>
                        <FilterButton active={tickets.length > 0} onClick={sheet.open}/>
                    </span>
                </div>
                <div className={classes.desktopMenus}>
                    <CheckMenu icon="/interface/admin/produits/billet.svg" label={ticketsLabel}
                               heading={t`Tickets`} choices={ticketChoices} value={tickets} onChange={setTickets}
                               width={340}/>
                </div>
            </div>

            <Button className={classNames(classes.phoneOnly, classes.addPhone)} leftSection={plusIcon} fullWidth
                    onClick={create.open}>
                {t`Add an attendee`}
            </Button>

            <section className={classes.card}>
                {attendeesQuery.isLoading && (
                    <div className={classes.loading}>
                        {Array.from({length: 4}).map((_, index) => <Skeleton key={index} height={52} radius={12}/>)}
                    </div>
                )}

                {!attendeesQuery.isLoading && attendees.length === 0 && (
                    <p className={classes.empty}>{filtered
                        ? t`No attendee matches these filters.`
                        : t`The attendees will appear here, one per ticket.`}</p>
                )}

                {attendees.length > 0 && (
                    <>
                        <div className={classNames(classes.attendeeGrid, classes.tableHead)}>
                            <span>{t`Attendee`}</span>
                            <span>{t`Ticket`}</span>
                            <span>{t`Order`}</span>
                            <span>{t`Bib`}</span>
                            <span/>
                        </div>
                        <div className={classes.list}>
                            {attendees.map((attendee) => {
                                const ticket = ticketLabel(attendee);
                                const bib = attendee.bib_number;

                                return (
                                    <div key={attendee.id} className={classNames(classes.attendeeGrid, classes.row)}>
                                        <span className={classes.personText}>
                                            <span className={classes.nameLine}>
                                                <UnstyledButton className={classes.nameButton}
                                                                onClick={() => setEditedId(attendee.id)}>
                                                    {`${attendee.first_name ?? ''} ${attendee.last_name ?? ''}`.trim()}
                                                </UnstyledButton>
                                                {statusTag(attendee)}
                                            </span>
                                            <span className={classNames(classes.small, classes.desktopOnly)}>{attendee.email}</span>
                                            <span className={classNames(classes.small, classes.phoneOnly)}>
                                                {bib != null ? `${ticket} · ${t`Bib ${bib}`}` : ticket}
                                            </span>
                                        </span>
                                        <span className={classNames(classes.ticketCell, classes.desktopOnly)}>{ticket}</span>
                                        <span className={classes.desktopOnly}>
                                            {attendee.order?.public_id && (
                                                <UnstyledButton className={classes.orderLink}
                                                                onClick={() => setOrderId(attendee.order_id)}>
                                                    #{attendee.order.public_id}
                                                </UnstyledButton>
                                            )}
                                        </span>
                                        <span className={classNames(classes.strong, classes.desktopOnly)}>{bib ?? '—'}</span>
                                        {actions(attendee)}
                                    </div>
                                );
                            })}
                        </div>

                        <div className={classes.footer}>
                            <span className={classes.range}>{t`${from} to ${to} of ${total} attendees`}</span>
                            <Pagination value={page} onChange={setPage} total={lastPage} marginTop={0}/>
                        </div>
                    </>
                )}
            </section>

            {isMobile && attendees.length < total && (
                <Button variant="outline" className={classes.loadMore} loading={attendeesQuery.isFetching}
                        onClick={() => setShown((current) => current + PER_PAGE)}>
                    {t`Load more attendees`}
                </Button>
            )}

            <FilterSheet opened={sheetOpen} onClose={sheet.close} onClear={() => setTickets([])}>
                <h3 className={classes.sheetSection}>{t`Tickets`}</h3>
                <SheetChips choices={ticketChoices} value={tickets} onChange={setTickets} label={t`Tickets`}/>
            </FilterSheet>

            {createOpen && <CreateAttendeeModal onClose={create.close} isOpen/>}
            {editedId && <ManageAttendeeModal attendeeId={editedId} onClose={() => setEditedId(undefined)}/>}
            {orderId && <ManageOrderModal orderId={orderId} onClose={() => setOrderId(undefined)}/>}
        </>
    );
};
