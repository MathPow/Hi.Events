import {useParams} from "react-router";
import {useGetEvent} from "../../../../queries/useGetEvent.ts";
import {PageTitle} from "../../../common/PageTitle";
import {PageBody} from "../../../common/PageBody";
import {WaitlistTable} from "../../../common/WaitlistTable";
import {WaitlistStatsCards} from "../../../common/WaitlistStats";
import {SearchBarWrapper} from "../../../common/SearchBar";
import {Pagination} from "../../../common/Pagination";
import {Button} from "@mantine/core";
import {ToolBar} from "../../../common/ToolBar";
import {useGetEventWaitlistEntries} from "../../../../queries/useGetEventWaitlistEntries.ts";
import {useGetWaitlistStats} from "../../../../queries/useGetWaitlistStats.ts";
import {useGetEventSettings} from "../../../../queries/useGetEventSettings.ts";
import {useFilterQueryParamSync} from "../../../../hooks/useFilterQueryParamSync.ts";
import {QueryFilterOperator, QueryFilters, WaitlistEntryStatus} from "../../../../types.ts";
import {TableSkeleton} from "../../../common/TableSkeleton";
import {t} from "@lingui/macro";
import {useDisclosure} from "@mantine/hooks";
import {OfferWaitlistModal} from "../../../modals/OfferWaitlistModal";
import {IconSend} from "@tabler/icons-react";
import {FilterChips} from "../../../common/FilterChips";
import classes from "./SoldOutWaitlist.module.scss";

type StatusChip = 'ALL' | WaitlistEntryStatus;

export const SoldOutWaitlist = () => {
    const {eventId} = useParams();
    const {data: event} = useGetEvent(eventId);
    const [searchParams, setSearchParams] = useFilterQueryParamSync();
    const entriesQuery = useGetEventWaitlistEntries(eventId, searchParams as QueryFilters);
    const entries = entriesQuery?.data?.data;
    const pagination = entriesQuery?.data?.meta;
    const {data: stats} = useGetWaitlistStats(eventId);
    const {data: eventSettings} = useGetEventSettings(eventId);
    const [offerModalOpen, {open: openOfferModal, close: closeOfferModal}] = useDisclosure(false);

    const statusFilter = (searchParams.filterFields?.status as { value?: string })?.value || null;

    const handleStatusFilter = (value: StatusChip) => {
        setSearchParams({
            pageNumber: 1,
            filterFields: {
                ...(searchParams.filterFields || {}),
                status: value !== 'ALL'
                    ? {operator: QueryFilterOperator.Equals, value}
                    : undefined,
            },
        }, true);
    };

    const statusChips = (
        <FilterChips<StatusChip>
            label={t`Status`}
            value={(statusFilter as StatusChip | null) ?? 'ALL'}
            onChange={handleStatusFilter}
            chips={[
                {value: 'ALL', label: t({message: 'All', context: 'waitlist filter'})},
                {value: WaitlistEntryStatus.Waiting, label: t`Waiting`, count: stats?.waiting},
                {value: WaitlistEntryStatus.Offered, label: t({message: 'Offered', context: 'waitlist filter'})},
                {value: WaitlistEntryStatus.Purchased, label: t({message: 'Purchased', context: 'waitlist filter'})},
                {value: WaitlistEntryStatus.OfferExpired, label: t({message: 'Expired', context: 'waitlist filter'})},
                {value: WaitlistEntryStatus.Cancelled, label: t({message: 'Cancelled', context: 'waitlist filter'})},
            ]}
        />
    );

    return (
        <PageBody>
            <PageTitle
                subheading={t`Manage your event's waitlist, view stats, and offer tickets to attendees.`}
                actions={(
                    <Button leftSection={<IconSend size={20}/>} onClick={openOfferModal}>
                        {t`Offer Tickets`}
                    </Button>
                )}
            >{t`Waitlist`}</PageTitle>

            {stats && <WaitlistStatsCards stats={stats} className={classes.stats}/>}

            <ToolBar
                searchComponent={() => (
                    <SearchBarWrapper
                        placeholder={t`Search by name or email...`}
                        setSearchParams={setSearchParams}
                        searchParams={searchParams}
                        pagination={pagination}
                    />
                )}
            />

            <TableSkeleton isVisible={!entries || !event}/>

            {(entries && event) && (
                <WaitlistTable
                    eventId={eventId}
                    entries={entries}
                    toolbar={statusChips}
                />
            )}

            {!!entries?.length && (
                <Pagination
                    value={searchParams.pageNumber}
                    onChange={(value) => setSearchParams({pageNumber: value})}
                    total={Number(pagination?.last_page)}
                />
            )}

            {(offerModalOpen && eventId) && (
                <OfferWaitlistModal onClose={closeOfferModal} eventId={eventId} eventSettings={eventSettings} stats={stats}/>
            )}
        </PageBody>
    );
};

export default SoldOutWaitlist;
