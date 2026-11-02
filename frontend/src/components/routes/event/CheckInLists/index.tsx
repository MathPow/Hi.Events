import {useState} from "react";
import {useParams} from "react-router";
import {plural, t} from "@lingui/macro";
import {Button, Menu, Skeleton, UnstyledButton} from "@mantine/core";
import {useDisclosure} from "@mantine/hooks";
import {IconCopy, IconExternalLink, IconPencil, IconTrash} from "@tabler/icons-react";
import QRCode from "react-qr-code";
import {CheckInList, IdParam, QueryFilters} from "../../../../types.ts";
import {useGetEventCheckInLists} from "../../../../queries/useGetCheckInLists.ts";
import {useGetEvent} from "../../../../queries/useGetEvent.ts";
import {useGetEventCheckInStats} from "../../../../queries/useGetEventCheckInStats.ts";
import {useDeleteCheckInList} from "../../../../mutations/useDeleteCheckInList.ts";
import {formatNumber} from "../../../../utilites/helpers.ts";
import {intlLocale} from "../../../../utilites/intlLocale.ts";
import {relativeDate} from "../../../../utilites/dates.ts";
import {confirmationDialog} from "../../../../utilites/confirmationDialog.tsx";
import {showError, showSuccess} from "../../../../utilites/notifications.tsx";
import {CreateCheckInListModal} from "../../../modals/CreateCheckInListModal";
import {EditCheckInListModal} from "../../../modals/EditCheckInListModal";
import {listTimes, nextOpening} from "./checkInListTimes.ts";
import classes from "./CheckInLists.module.scss";

const icon = (path: string) => `/interface/admin/${path}.svg`;

const ALL_LISTS: QueryFilters = {pageNumber: 1, perPage: 100};

// The pastilles take the dashboard's tones in turn; a list of merch only gets the t-shirt.
const TONES = ['pink', 'blue', 'yellow'] as const;

// Open lists first, then the ones to come (soonest first), then the closed ones.
const stage = (list: CheckInList) => list.is_expired ? 2 : (list.is_active ? 0 : 1);
const sortLists = (lists: CheckInList[]) => [...lists].sort((a, b) => stage(a) - stage(b)
    || (a.activates_at ?? '').localeCompare(b.activates_at ?? '')
    || Number(a.id) - Number(b.id));

const checkInUrl = (list: CheckInList) => `${window.location.origin}/check-in/${list.short_id}`;

const percentOf = (part: number, total: number) => new Intl.NumberFormat(intlLocale(), {style: 'percent', maximumFractionDigits: 0})
    .format(total > 0 ? part / total : 0);

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const copyLink = (list: CheckInList) => navigator.clipboard.writeText(checkInUrl(list))
    .then(() => showSuccess(t`Check-In URL copied to clipboard`));

const openScanner = (list: CheckInList) => window.open(`/check-in/${list.short_id}`, '_blank');

const InfoCard = ({tone, iconPath, value, label, note}: {
    tone: 'green' | 'pink' | 'yellow',
    iconPath: string,
    value: string,
    label: string,
    note?: string | null,
}) => (
    <div className={classes.info}>
        <span className={classes.infoPastille} data-tone={tone}><img src={icon(iconPath)} alt=""/></span>
        <div className={classes.infoText}>
            <span className={classes.infoValue}>{value}</span>
            <span className={classes.infoLabel}>{label}</span>
            {note && <span className={classes.infoNote}>{note}</span>}
        </div>
    </div>
);

const ListCard = ({list, index, timeZone, onEdit, onDelete}: {
    list: CheckInList,
    index: number,
    timeZone?: string,
    onEdit: () => void,
    onDelete: () => void,
}) => {
    const isOpen = list.is_active && !list.is_expired;
    const merchOnly = !!list.products?.length && list.products.every((product) => product.product_type && product.product_type !== 'TICKET');
    const status = list.is_expired
        ? {label: t({message: 'Expired', context: 'check-in list'}), tone: 'neutral'}
        : !list.is_active
            ? {label: t`Not open yet`, tone: 'neutral'}
            : {label: t({message: 'Active', context: 'check-in list'}), tone: 'ok'};
    const percentage = list.total_attendees > 0 ? Math.min(100, list.checked_in_attendees / list.total_attendees * 100) : 0;
    const arrived = list.checked_in_attendees;
    const total = list.total_attendees;

    return (
        <article className={classes.card}>
            <div className={classes.cardHead}>
                <span className={classes.listPastille} data-tone={TONES[index % TONES.length]}>
                    <img src={icon(merchOnly ? 'accueil/chandail' : 'rapports/presence')} alt=""/>
                </span>
                <div className={classes.cardTitleBlock}>
                    <h2 className={classes.cardTitle}>{list.name}</h2>
                    <span className={classes.cardTimes}>
                        <img src={icon('accueil/horloge-petite')} alt=""/>
                        {listTimes(list, timeZone)}
                    </span>
                </div>
                <Menu position="bottom-end" width={240} withinPortal>
                    <Menu.Target>
                        <UnstyledButton className={classes.moreButton} aria-label={t`Actions`}>
                            <img src={icon('produits/actions')} alt=""/>
                        </UnstyledButton>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Item leftSection={<IconPencil size={16}/>} onClick={onEdit}>{t`Edit Check-In List`}</Menu.Item>
                        <Menu.Item leftSection={<IconCopy size={16}/>} onClick={() => copyLink(list)}>{t`Copy Check-In URL`}</Menu.Item>
                        <Menu.Item leftSection={<IconExternalLink size={16}/>} onClick={() => openScanner(list)}>
                            {t({message: 'Open Check-In Page', context: 'check-in list'})}
                        </Menu.Item>
                        <Menu.Divider/>
                        <Menu.Item color="red" leftSection={<IconTrash size={16}/>} onClick={onDelete}>
                            {t`Delete Check-In List`}
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            </div>

            {list.description && <p className={classes.description}>{list.description}</p>}

            <div className={classes.tags}>
                <span className={classes.tag} data-tone={status.tone}>{status.label}</span>
                {list.products?.map((product) => (
                    <span key={product.id} className={classes.tag} data-tone="product">{product.title}</span>
                ))}
                {list.pin && (
                    <span className={classes.tag} data-tone="neutral">
                        <img src={icon('accueil/cadenas')} alt=""/>
                        {t({message: 'PIN', context: 'check-in list tag'})}
                    </span>
                )}
                {list.allow_door_sales && (
                    <span className={classes.tag} data-tone="waiting">
                        <img src={icon('accueil/carte')} alt=""/>
                        {t`Door sales`}
                    </span>
                )}
            </div>

            <div className={classes.progress}>
                <div className={classes.progressText}>
                    <span>{t`${arrived} / ${total} arrived`}</span>
                    <span>{percentOf(arrived, total)}</span>
                </div>
                <span className={classes.bar} data-empty={arrived === 0 || undefined} role="progressbar" aria-valuemin={0} aria-valuemax={100}
                      aria-valuenow={Math.round(percentage)}>
                    <span style={{width: `${percentage}%`}}/>
                </span>
            </div>

            <div className={classes.cardActions}>
                <Button className={isOpen ? classes.scanButton : classes.scanButtonOutline}
                        leftSection={<img src={icon('accueil/scan')} alt=""/>}
                        onClick={() => openScanner(list)}>
                    {t`Open the scanner`}
                </Button>
                <UnstyledButton className={classes.linkButton} onClick={() => copyLink(list)}
                                aria-label={t`Copy Check-In URL`} title={t`Copy Check-In URL`}>
                    <img src={icon('accueil/lien')} alt=""/>
                </UnstyledButton>
            </div>
        </article>
    );
};

// « Scanner avec un téléphone »: the QR code of a list's link, to open it on a phone or pass it on.
const PhonePanel = ({lists}: { lists: CheckInList[] }) => {
    const [selectedId, setSelectedId] = useState<IdParam | undefined>();
    const list = lists.find((candidate) => candidate.id === selectedId)
        ?? lists.find((candidate) => candidate.is_active && !candidate.is_expired)
        ?? lists[0];
    const name = list.name;
    const link = checkInUrl(list);
    const mailto = `mailto:?subject=${encodeURIComponent(t`Check-in link: ${name}`)}&body=${encodeURIComponent(link)}`;

    return (
        <section className={classes.phone}>
            <span className={classes.qr}><QRCode value={link} size={100} fgColor="#372721"/></span>
            <div className={classes.phoneText}>
                <h2 className={classes.phoneTitle}>{t`Scan with a phone`}</h2>
                <p>{t`Each list has its own link. Share it with your volunteers: they open it on their phone and scan the tickets, with no account or app.`}</p>
                <div className={classes.phoneActions}>
                    {lists.length > 1 && (
                        <Menu position="bottom-start" width={260} withinPortal>
                            <Menu.Target>
                                <UnstyledButton className={classes.listChoice}>
                                    {name}
                                    <img src={icon('tableau/chevron-bas')} alt=""/>
                                </UnstyledButton>
                            </Menu.Target>
                            <Menu.Dropdown>
                                {lists.map((candidate) => (
                                    <Menu.Item key={candidate.id} onClick={() => setSelectedId(candidate.id)}>
                                        {candidate.name}
                                    </Menu.Item>
                                ))}
                            </Menu.Dropdown>
                        </Menu>
                    )}
                    <Button className={classes.darkButton} leftSection={<img src={icon('accueil/lien-creme')} alt=""/>}
                            onClick={() => copyLink(list)}>
                        {t({message: 'Copy link', context: 'check-in list'})}
                    </Button>
                    <Button component="a" href={mailto} className={classes.outlineButton}
                            leftSection={<img src={icon('parametres/courriel')} alt=""/>}>
                        {t`Send by email`}
                    </Button>
                </div>
            </div>
        </section>
    );
};

/**
 * « Accueil et scan » (formerly « Listes de pointage », Figma « Admin · Événement · Accueil et scan »):
 * how many have arrived, the lists open now and the latest arrival, then each list with its scanner
 * and its link, and how to scan with a phone.
 */
const CheckInLists = () => {
    const {eventId} = useParams();
    const {data: event} = useGetEvent(eventId);
    const {data: checkInStats} = useGetEventCheckInStats(eventId);
    const listsQuery = useGetEventCheckInLists(eventId, ALL_LISTS);
    const lists = listsQuery.data?.data && sortLists(listsQuery.data.data);
    const deleteMutation = useDeleteCheckInList();
    const [createOpen, {open: openCreate, close: closeCreate}] = useDisclosure(false);
    const [editingId, setEditingId] = useState<IdParam | undefined>();
    const timeZone = event?.timezone;

    const remove = (list: CheckInList) => confirmationDialog(
        t`Are you sure you would like to delete this Check-In List?`,
        () => deleteMutation.mutate({checkInListId: list.id as IdParam, eventId}, {
            onSuccess: () => showSuccess(t`Check-In List deleted successfully`),
            onError: (error: any) => showError(error.message),
        }),
    );

    const arrived = checkInStats?.total_checked_in_attendees ?? 0;
    const registered = checkInStats?.total_attendees ?? 0;
    const registeredShare = percentOf(arrived, registered);
    const openCount = (lists ?? []).filter((list) => list.is_active && !list.is_expired).length;
    const next = nextOpening(lists ?? [], timeZone);
    const latest = (lists ?? [])
        .filter((list) => list.last_check_in)
        .sort((a, b) => (b.last_check_in?.checked_in_at ?? '').localeCompare(a.last_check_in?.checked_in_at ?? ''))[0];
    const latestName = latest?.last_check_in?.attendee_name;
    const latestList = latest?.name;
    const upcomingCount = next?.count ?? 0;
    const nextTime = next?.time;
    const nextDay = next?.day;
    const nextNote = next ? plural(upcomingCount, {
        one: `# other at ${nextTime} on ${nextDay}`,
        other: `# others, the first at ${nextTime} on ${nextDay}`,
    }) : null;

    return (
        <div className={classes.page}>
            <header className={classes.header}>
                <div className={classes.headerText}>
                    <h1 className={classes.title}>{t`Check-in and scanning`}</h1>
                    <p className={classes.subtitle}>{t`Entry lists to welcome participants on site.`}</p>
                </div>
                <Button className={classes.createButton} leftSection={<img src={icon('produits/plus')} alt=""/>}
                        onClick={openCreate}>
                    {t`Create a list`}
                </Button>
            </header>

            {!lists ? <Skeleton height={107} radius={24}/> : (
                <div className={classes.infos}>
                    <InfoCard
                        tone="green"
                        iconPath="tableau/verifie"
                        value={`${formatNumber(arrived)} / ${formatNumber(registered)}`}
                        label={t`Participants arrived`}
                        note={t`${registeredShare} of registrants`}
                    />
                    <InfoCard
                        tone="pink"
                        iconPath="accueil/liste"
                        value={String(openCount)}
                        label={plural(openCount, {one: 'Open list', other: 'Open lists'})}
                        note={nextNote}
                    />
                    <InfoCard
                        tone="yellow"
                        iconPath="accueil/horloge"
                        value={latest?.last_check_in ? capitalize(relativeDate(latest.last_check_in.checked_in_at)) : '—'}
                        label={t`Latest arrival`}
                        note={latest ? `${latestName} · ${latestList}` : t`No arrivals yet`}
                    />
                </div>
            )}

            {!lists && (
                <div className={classes.lists}>
                    {[0, 1].map((index) => <Skeleton key={index} height={300} radius={28}/>)}
                </div>
            )}

            {lists && (
                <div className={classes.lists}>
                    {lists.map((list, index) => (
                        <ListCard key={list.id} list={list} index={index} timeZone={timeZone}
                                  onEdit={() => setEditingId(list.id as IdParam)} onDelete={() => remove(list)}/>
                    ))}
                    <UnstyledButton className={classes.createCard} onClick={openCreate}>
                        <span className={classes.createPastille}><img src={icon('accueil/plus')} alt=""/></span>
                        <span className={classes.createTitle}>{t`Create a list`}</span>
                        <span className={classes.createHint}>{t`E.g. one entrance per door, the t-shirt pickup, the volunteers.`}</span>
                    </UnstyledButton>
                </div>
            )}

            {!!lists?.length && <PhonePanel lists={lists}/>}

            {createOpen && <CreateCheckInListModal onClose={closeCreate}/>}
            {editingId && <EditCheckInListModal onClose={() => setEditingId(undefined)} checkInListId={editingId}/>}
        </div>
    );
};

export default CheckInLists;
