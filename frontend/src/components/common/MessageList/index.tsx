import {IdParam, Message, MessageType} from "../../../types.ts";
import classes from './MessageList.module.scss';
import {relativeDate} from "../../../utilites/dates.ts";
import {getInitials} from "../../../utilites/helpers.ts";
import {t} from "@lingui/macro";
import {IconPaperclip} from "@tabler/icons-react";
import {StatusTag, StatusTone} from "../StatusTag";
import {SkeletonCircle, SkeletonLine, SkeletonPill, varied} from "../Skeletons";

interface MessageListProps {
    messages: Message[];
    selectedId?: IdParam;
    onSelect: (message: Message) => void;
}

// Sent: green; on its way or waiting for its time: yellow; failed: red; cancelled: neutral.
export const messageStatus = (status?: Message['status']): { label: string, tone: StatusTone } => {
    switch (status) {
        case 'SENT':
            return {label: t({message: 'Sent', context: 'message status'}), tone: 'ok'};
        case 'PROCESSING':
            return {label: t({message: 'Sending', context: 'message status'}), tone: 'waiting'};
        case 'SCHEDULED':
            return {label: t({message: 'Scheduled', context: 'message status'}), tone: 'waiting'};
        case 'PENDING_REVIEW':
            return {label: t`Pending Review`, tone: 'waiting'};
        case 'CANCELLED':
            return {label: t({message: 'Cancelled', context: 'message status'}), tone: 'neutral'};
        case 'FAILED':
            return {label: t({message: 'Failed', context: 'message status'}), tone: 'problem'};
        default:
            return {label: String(status ?? ''), tone: 'neutral'};
    }
};

export const typeLabel = (type: MessageType) => {
    const map: Record<string, string> = {
        [MessageType.OrderOwnersWithProduct]: t`Order owners with products`,
        [MessageType.IndividualAttendees]: t`Individual attendees`,
        [MessageType.AllAttendees]: t`All attendees`,
        [MessageType.TicketHolders]: t`Ticket holders`,
        [MessageType.OrderOwner]: t`Order owner`,
    };
    return map[type] || type;
};

export const senderName = (message: Message) => message.sent_by_user
    ? `${message.sent_by_user.first_name} ${message.sent_by_user.last_name}`
    : t`Unknown`;

// Scheduled and cancelled messages: when they were (or would have been) sent.
export const messageTimestamp = (message: Message) => (message.status === 'SCHEDULED' || message.status === 'CANCELLED')
    ? (message.scheduled_at ?? message.sent_at ?? message.created_at)
    : (message.sent_at ?? message.created_at ?? message.scheduled_at);

const MessageItem = ({message, isSelected, onSelect}: {
    message: Message;
    isSelected: boolean;
    onSelect: () => void;
}) => {
    const isCancelled = message.status === 'CANCELLED';
    const sender = senderName(message);
    const displayTimestamp = messageTimestamp(message);
    const displayDate = displayTimestamp ? relativeDate(displayTimestamp) : t`Unknown`;
    const status = messageStatus(message.status);

    return (
        <div
            className={classes.messageItem}
            data-selected={isSelected || undefined}
            data-cancelled={isCancelled || undefined}
            onClick={onSelect}
            role="option"
            aria-selected={isSelected}
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect();
                }
            }}
        >
            <span className={classes.avatar} aria-hidden>{getInitials(sender)}</span>
            <div className={classes.itemContent}>
                <div className={classes.itemTopRow}>
                    <span className={classes.subject}>{message.subject}</span>
                    <span className={classes.date}>{displayDate}</span>
                </div>
                <div className={classes.preview}>{message.message_preview}</div>
                <div className={classes.itemBottomRow}>
                    <StatusTag tone={status.tone} className={classes.status}>{status.label}</StatusTag>
                    <span className={classes.typeLabel}>{typeLabel(message.type)}</span>
                    {!!message.attachments?.length && (
                        <span className={classes.attachmentCount} title={message.attachments.map(a => a.name).join(', ')}>
                            <IconPaperclip size={14}/>
                            {message.attachments.length}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

// The messages of an event, newest first: subject, start of the text, status and recipients.
export const MessageList = ({messages, selectedId, onSelect}: MessageListProps) => {
    return (
        <div className={classes.listContainer} role="listbox" aria-label={t`Messages`}>
            {messages.map((message) => (
                <MessageItem
                    key={message.id}
                    message={message}
                    isSelected={message.id === selectedId}
                    onSelect={() => onSelect(message)}
                />
            ))}
        </div>
    );
};

// The message rows while they load.
export const MessageListSkeleton = ({rows = 5}: { rows?: number }) => (
    <div className={classes.listContainer} aria-busy>
        {[...Array(rows)].map((_, row) => (
            <div key={row} className={classes.messageItem} data-selected={row === 0 || undefined}>
                <SkeletonCircle/>
                <div className={classes.itemContent}>
                    <div className={classes.itemTopRow}>
                        <SkeletonLine width={varied(row)} height={14}/>
                        <SkeletonLine width={44} height={9}/>
                    </div>
                    <SkeletonLine width={varied(row, 3)} height={10}/>
                    <div className={classes.itemBottomRow}>
                        <SkeletonPill width={row % 2 ? 60 : 72} height={22}/>
                        <SkeletonLine width={row % 2 ? 84 : 70} height={10}/>
                    </div>
                </div>
            </div>
        ))}
    </div>
);
