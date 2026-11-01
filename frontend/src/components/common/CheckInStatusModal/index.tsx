import {Modal} from '@mantine/core';
import {IconCheck, IconX} from '@tabler/icons-react';
import {Attendee, CheckInList, IdParam} from '../../../types';
import {t, Trans} from '@lingui/macro';
import {prettyDate} from '../../../utilites/dates';
import {useGetEventCheckInLists} from '../../../queries/useGetCheckInLists';
import {LoadingMask} from '../LoadingMask';
import classes from './CheckInStatusModal.module.scss';
import {BibNumber} from '../BibNumber';
import {StatusTag} from '../StatusTag';
import {PublicIcon} from '../PublicIcon';

interface CheckInStatusModalProps {
    attendee: Attendee;
    eventTimezone: string;
    eventId: IdParam;
    isOpen: boolean;
    onClose: () => void;
}

// Where an attendee was checked in: one line per check-in list, green when done, the lists their
// ticket doesn't give access to apart and dimmed.
export const CheckInStatusModal = ({
    attendee,
    eventTimezone,
    eventId,
    isOpen,
    onClose
}: CheckInStatusModalProps) => {
    const {data: checkInListsResponse, isLoading} = useGetEventCheckInLists(eventId);

    const checkInLists = checkInListsResponse?.data || [];
    const attendeeCheckIns = attendee.check_ins || [];

    const getCheckInForList = (listId: number | undefined) => {
        return attendeeCheckIns.find(ci => ci.check_in_list_id === listId);
    };

    const isAttendeeEligibleForList = (list: CheckInList) => {
        if (!list.products || list.products.length === 0) {
            return true;
        }
        return list.products.some(product => product.id === attendee.product_id);
    };

    const eligibleLists = checkInLists.filter(list => isAttendeeEligibleForList(list));
    const ineligibleLists = checkInLists.filter(list => !isAttendeeEligibleForList(list));

    const renderListItem = (list: CheckInList, isEligible: boolean) => {
        const checkIn = getCheckInForList(list.id);
        const isCheckedIn = !!checkIn;

        return (
            <div key={list.id} className={classes.listItem} data-ineligible={!isEligible || undefined}>
                <span className={classes.listIcon} data-checked-in={(isEligible && isCheckedIn) || undefined}>
                    {isEligible && isCheckedIn ? <IconCheck size={18} stroke={2.5}/> : <IconX size={18}/>}
                </span>
                <div className={classes.listText}>
                    <span className={classes.listName}>{list.name}</span>
                    {isCheckedIn && checkIn.created_at && (
                        <span className={classes.listMeta}>
                            {prettyDate(checkIn.created_at, eventTimezone)}
                        </span>
                    )}
                    {!isEligible && (
                        <span className={classes.listMeta}>
                            <Trans>Attendee's ticket not included in this list</Trans>
                        </span>
                    )}
                </div>
                {isEligible ? (
                    <StatusTag tone={isCheckedIn ? 'ok' : 'neutral'}>
                        {isCheckedIn
                            ? t({message: 'Checked in', context: 'attendee check-in'})
                            : t({message: 'Not checked in', context: 'attendee check-in'})}
                    </StatusTag>
                ) : (
                    <StatusTag tone="neutral">{t({message: 'Not Eligible', context: 'attendee check-in'})}</StatusTag>
                )}
            </div>
        );
    };

    return (
        <Modal.Root opened={isOpen} onClose={onClose} size="md">
            <Modal.Overlay/>
            <Modal.Content>
                <Modal.Header>
                    <Modal.Title>
                        {t({message: 'Check-In Status', context: 'attendee check-in'})}
                    </Modal.Title>
                    <Modal.CloseButton/>
                </Modal.Header>
                <Modal.Body>
                    {isLoading ? (
                        <div className={classes.loading}>
                            <LoadingMask/>
                        </div>
                    ) : (
                        <div className={classes.content}>
                            <div className={classes.attendee}>
                                <span className={classes.pastille}><PublicIcon name="qr" size={20}/></span>
                                <div className={classes.attendeeText}>
                                    <span className={classes.attendeeName}>
                                        {attendee.first_name} {attendee.last_name}
                                    </span>
                                    <span className={classes.attendeeMeta}>
                                        <BibNumber bibNumber={attendee.bib_number} size="xs"/>
                                        {attendee.public_id}
                                    </span>
                                </div>
                            </div>

                            {checkInLists.length === 0 ? (
                                <p className={classes.empty}>
                                    {t({message: 'No check-in lists available for this event.', context: 'attendee check-in'})}
                                </p>
                            ) : (
                                <>
                                    {eligibleLists.length > 0 && (
                                        <section className={classes.group}>
                                            <h3 className={classes.groupTitle}>
                                                {t({message: 'Eligible Check-In Lists', context: 'attendee check-in'})}
                                            </h3>
                                            <div className={classes.list}>
                                                {eligibleLists.map((list) => renderListItem(list, true))}
                                            </div>
                                        </section>
                                    )}

                                    {ineligibleLists.length > 0 && (
                                        <section className={classes.group}>
                                            <h3 className={classes.groupTitle}>
                                                {t({message: 'Other Lists (Ticket Not Included)', context: 'attendee check-in'})}
                                            </h3>
                                            <div className={classes.list}>
                                                {ineligibleLists.map((list) => renderListItem(list, false))}
                                            </div>
                                        </section>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </Modal.Body>
            </Modal.Content>
        </Modal.Root>
    );
};
