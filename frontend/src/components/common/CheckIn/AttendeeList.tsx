import {Button, Loader} from "@mantine/core";
import {IconCheck} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import {Attendee} from "../../../types.ts";
import classes from "../../layouts/CheckIn/CheckIn.module.scss";
import {BibNumber} from "../BibNumber";

interface AttendeeListProps {
    attendees: Attendee[] | undefined;
    products: { id: number; title: string; }[] | undefined;
    isLoading: boolean;
    // The attendee being checked in or out, and whether any check-in is under way.
    pendingAttendeeId?: string;
    isBusy: boolean;
    allowOrdersAwaitingOfflinePaymentToCheckIn: boolean;
    onCheckInToggle: (attendee: Attendee) => void;
    onClickSound?: () => void;
}

const initials = (attendee: Attendee) =>
    `${attendee.first_name?.[0] ?? ''}${attendee.last_name?.[0] ?? ''}`.toUpperCase() || '?';

// The attendees of the check-in list, in one card: name, ticket, status and the check-in button.
export const AttendeeList = ({
                                 attendees,
                                 products,
                                 isLoading,
                                 pendingAttendeeId,
                                 isBusy,
                                 allowOrdersAwaitingOfflinePaymentToCheckIn,
                                 onCheckInToggle,
                                 onClickSound
                             }: AttendeeListProps) => {
    const checkInButtonText = (attendee: Attendee) => {
        if (!allowOrdersAwaitingOfflinePaymentToCheckIn && attendee.status === 'AWAITING_PAYMENT') {
            return t`Cannot Check In`;
        }

        if (attendee.status === 'CANCELLED') {
            return t`Cannot Check In (Cancelled)`;
        }

        if (attendee.check_in) {
            return t`Check Out`;
        }

        return t`Check In`;
    };

    if (isLoading || !attendees || !products) {
        return (
            <div className={classes.listCard}>
                <div className={classes.loading}>
                    <Loader size={32} color="var(--dehors-brun)"/>
                </div>
            </div>
        );
    }

    if (attendees.length === 0) {
        return (
            <div className={classes.listCard}>
                <p className={classes.noResults}>{t`No attendees to show.`}</p>
            </div>
        );
    }

    return (
        <div className={classes.listCard}>
            {attendees.map(attendee => {
                const isCancelled = attendee.status === 'CANCELLED';
                const isAwaitingPayment = attendee.status === 'AWAITING_PAYMENT';
                const product = products.find(product => product.id === attendee.product_id)?.title;

                return (
                    <div className={classes.attendee} key={attendee.public_id} data-checked-in={!!attendee.check_in || undefined}>
                        <span className={classes.avatar} aria-hidden>{initials(attendee)}</span>
                        <div className={classes.details}>
                            <div className={classes.nameRow}>
                                <span className={classes.name}>{attendee.first_name} {attendee.last_name}</span>
                                <BibNumber bibNumber={attendee.bib_number} size="xs"/>
                                {attendee.check_in && (
                                    <span className={classes.tag} data-tone="ok">
                                        <IconCheck size={14} stroke={2.5}/>
                                        {t({message: 'Checked in', context: 'attendee check-in'})}
                                    </span>
                                )}
                                {isCancelled && <span className={classes.tag} data-tone="problem">{t`Ticket Cancelled`}</span>}
                                {isAwaitingPayment && <span className={classes.tag} data-tone="waiting">{t`Awaiting payment`}</span>}
                            </div>
                            <span className={classes.meta}>
                                {product && <>{product} · </>}{attendee.public_id}
                            </span>
                        </div>
                        <Button
                            className={attendee.check_in ? classes.checkOutButton : classes.checkInButton}
                            onClick={() => {
                                onClickSound?.();
                                onCheckInToggle(attendee);
                            }}
                            data-blocked={(isAwaitingPayment && !allowOrdersAwaitingOfflinePaymentToCheckIn) || undefined}
                            disabled={isBusy || isCancelled}
                            loading={pendingAttendeeId === attendee.public_id}
                        >
                            {checkInButtonText(attendee)}
                        </Button>
                    </div>
                );
            })}
        </div>
    );
};
