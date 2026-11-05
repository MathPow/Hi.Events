import {t, Trans} from "@lingui/macro";
import {useEffect, useRef, useState} from "react";
import {useParams, useSearchParams} from "react-router";
import {Button, Pagination, SegmentedControl} from "@mantine/core";
import {
    IconArrowBackUp,
    IconBell,
    IconBellOff,
    IconCalendarEvent,
    IconCheck,
    IconChecks,
    IconInbox,
    IconMail,
    IconSend,
    IconTrash,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import {PageBody} from "../../../common/PageBody";
import {SkeletonLine, SkeletonPill} from "../../../common/Skeletons";
import {PageTitle} from "../../../common/PageTitle";
import {Card} from "../../../common/Card";
import {IosInstallSteps} from "../../../common/InstallAppPrompt";
import {useGetOrganizer} from "../../../../queries/useGetOrganizer.ts";
import {useGetOrganizerMessages} from "../../../../queries/useGetOrganizerMessages.ts";
import {
    useDeleteOrganizerMessage,
    useMarkAllOrganizerMessagesRead,
    useSetOrganizerMessageRead,
} from "../../../../mutations/useOrganizerMessageMutations.ts";
import {OrganizerMessage} from "../../../../api/organizerMessage.client.ts";
import {useWebPush} from "../../../../hooks/useWebPush.ts";
import {relativeDate} from "../../../../utilites/dates.ts";
import {confirmationDialog} from "../../../../utilites/confirmationDialog.tsx";
import {showError, showSuccess} from "../../../../utilites/notifications.tsx";
import {ReplyModal} from "./ReplyModal.tsx";
import {ComposeMessage} from "./ComposeMessage.tsx";
import classes from "./Messages.module.scss";

// Les notifications de cet appareil: les activer, ou dire pourquoi c'est impossible ici.
const DeviceNotifications = () => {
    const {state, isBusy, enable, disable} = useWebPush();

    if (state === 'loading' || state === 'unsupported') {
        return null;
    }

    const handleEnable = async () => {
        try {
            if (await enable()) {
                showSuccess(t`Notifications are on for this device`);
            }
        } catch {
            showError(t`Notifications could not be turned on. Please try again.`);
        }
    };

    return (
        <Card className={classes.notifications}>
            <span className={classes.notificationsIcon}>
                {state === 'on' ? <IconBell size={22}/> : <IconBellOff size={22}/>}
            </span>
            <div className={classes.notificationsText}>
                <strong>{t`Notifications on this device`}</strong>
                {state === 'on' && <span>{t`A notification arrives here as soon as someone writes to you.`}</span>}
                {state === 'off' && <span>{t`Get a notification on this phone or computer as soon as someone writes to you.`}</span>}
                {state === 'denied' && <span>{t`Notifications are blocked for this site. Allow them in your browser settings, then reload the page.`}</span>}
                {state === 'ios-install' && (
                    <>
                        <span>{t`On iPhone and iPad, notifications only work in the app added to the home screen:`}</span>
                        <IosInstallSteps/>
                    </>
                )}
            </div>
            {state === 'off' && (
                <Button onClick={handleEnable} loading={isBusy} leftSection={<IconBell size={18}/>}>
                    {t`Turn on`}
                </Button>
            )}
            {state === 'on' && (
                <Button variant="default" onClick={disable} loading={isBusy}>
                    {t`Turn off`}
                </Button>
            )}
        </Card>
    );
};

const ThreadEntry = ({author, date, text, fromOrganizer}: {
    author: string,
    date: string,
    text: string,
    fromOrganizer?: boolean,
}) => (
    <div className={classes.threadEntry} data-organizer={fromOrganizer || undefined}>
        <div className={classes.threadMeta}>
            <strong>{author}</strong>
            <time dateTime={date} title={dayjs.utc(date).local().format('YYYY-MM-DD HH:mm')}>
                {relativeDate(date)}
            </time>
        </div>
        <p className={classes.messageText}>{text}</p>
    </div>
);

const MessageRow = ({message, organizerName, isOpen, onToggle, onReply}: {
    message: OrganizerMessage,
    organizerName?: string,
    isOpen: boolean,
    onToggle: () => void,
    onReply: () => void,
}) => {
    const {organizerId} = useParams();
    const setRead = useSetOrganizerMessageRead();
    const deleteMessage = useDeleteOrganizerMessage();
    const isUnread = !message.read_at;

    const handleDelete = () => confirmationDialog(t`Delete this message?`, () => {
        deleteMessage.mutate({organizerId, messageId: message.id}, {
            onSuccess: () => showSuccess(t`Message deleted`),
            onError: () => showError(t`The message could not be deleted.`),
        });
    });

    return (
        <article id={`message-${message.id}`} className={classes.message} data-unread={isUnread || undefined}
                 data-open={isOpen || undefined}>
            <button type="button" className={classes.messageHead} onClick={onToggle} aria-expanded={isOpen}>
                <span className={classes.unreadDot} aria-hidden/>
                <span className={classes.sender}>
                    <span className={classes.senderName}>{message.sender_name}</span>
                    <span className={classes.senderEmail}>{message.sender_email}</span>
                    {message.replied_at && (
                        <span className={classes.repliedTag}>
                            <IconCheck size={13} stroke={2.5}/>
                            {t({message: 'Replied', context: 'organizer message'})}
                        </span>
                    )}
                </span>
                <time className={classes.date} dateTime={message.created_at}
                      title={dayjs.utc(message.created_at).local().format('YYYY-MM-DD HH:mm')}>
                    {relativeDate(message.created_at)}
                </time>
                {message.event && (
                    <span className={classes.eventTag}>
                        <IconCalendarEvent size={14}/>
                        {message.event.title}
                    </span>
                )}
                {!isOpen && <span className={classes.preview}>{message.message}</span>}
                {isUnread && <span className={classes.visuallyHidden}>{t`Unread`}</span>}
            </button>

            {isOpen && (
                <div className={classes.messageBody}>
                    {message.replies?.length ? (
                        <div className={classes.thread}>
                            <ThreadEntry author={message.sender_name} date={message.created_at} text={message.message}/>
                            {message.replies.map((reply) => (
                                <ThreadEntry key={reply.id} author={organizerName ?? ''} date={reply.created_at}
                                             text={reply.message} fromOrganizer/>
                            ))}
                        </div>
                    ) : (
                        <p className={classes.messageText}>{message.message}</p>
                    )}
                    <div className={classes.messageActions}>
                        <Button leftSection={<IconArrowBackUp size={18}/>} onClick={onReply}>
                            {t`Reply`}
                        </Button>
                        <Button variant="default" leftSection={<IconMail size={18}/>}
                                loading={setRead.isPending}
                                onClick={() => setRead.mutate({organizerId, messageId: message.id, read: false})}>
                            {t`Mark as unread`}
                        </Button>
                        <Button variant="subtle" color="red" leftSection={<IconTrash size={18}/>}
                                loading={deleteMessage.isPending} onClick={handleDelete}>
                            {t`Delete`}
                        </Button>
                    </div>
                </div>
            )}
        </article>
    );
};

// Closed messages: the sender and their email, the date, the event tag, then the preview.
const MessagesSkeleton = () => (
    <div className={classes.list} aria-busy>
        {[0, 1, 2, 3].map((index) => (
            <article key={index} className={classes.message}>
                <div className={classes.messageHead} style={{alignItems: 'center', rowGap: 12, cursor: 'default'}}>
                    <span className={classes.unreadDot}/>
                    <div className={classes.sender} style={{alignItems: 'center', rowGap: 10}}>
                        <SkeletonLine width={[112, 96, 124, 104][index]} height={16}/>
                        <SkeletonLine width={[168, 150, 176, 160][index]} height={10}/>
                    </div>
                    <SkeletonLine width={index % 2 ? 64 : 76} height={10}/>
                    <SkeletonPill width={index % 2 ? 190 : 214} height={24}/>
                    <SkeletonLine width={['52%', '64%', '40%', '70%'][index]} height={14}/>
                </div>
            </article>
        ))}
    </div>
);

/**
 * La boite de reception de l'organisateur: les messages du bouton « Contacter » de sa page et de
 * ses evenements (aussi envoyes par courriel), et les notifications de cet appareil.
 */
const Messages = () => {
    const {organizerId} = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const [page, setPage] = useState(1);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [openId, setOpenId] = useState<number | null>(null);
    const [replyTo, setReplyTo] = useState<OrganizerMessage | null>(null);
    const [isComposing, setIsComposing] = useState(false);
    const {data: organizer} = useGetOrganizer(organizerId);
    const {data, isLoading} = useGetOrganizerMessages(organizerId, page, filter === 'unread');
    const setRead = useSetOrganizerMessageRead();
    const markAllRead = useMarkAllOrganizerMessagesRead();
    const linkedMessage = Number(searchParams.get('message')) || null;
    const handledLink = useRef<number | null>(null);

    const messages = data?.data ?? [];
    const unreadCount = data?.meta.unread_count ?? 0;

    const open = (message: OrganizerMessage) => {
        setOpenId(message.id);
        if (!message.read_at) {
            setRead.mutate({organizerId, messageId: message.id, read: true});
        }
    };

    // Arrive d'une notification (?message=): ce message s'ouvre, lu, avec la reponse a ecrire
    // (&reply=1).
    useEffect(() => {
        if (!linkedMessage || handledLink.current === linkedMessage) {
            return;
        }
        const message = messages.find((candidate) => candidate.id === linkedMessage);
        if (!message) {
            return;
        }
        handledLink.current = linkedMessage;
        open(message);
        if (searchParams.get('reply')) {
            setReplyTo(message);
        }
        searchParams.delete('message');
        searchParams.delete('reply');
        setSearchParams(searchParams, {replace: true});
        requestAnimationFrame(() => document.getElementById(`message-${message.id}`)
            ?.scrollIntoView({block: 'center', behavior: 'smooth'}));
        // Une fois par message lie (handledLink): les autres valeurs sont lues a ce moment.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [linkedMessage, messages]);

    return (
        <PageBody>
            <PageTitle actions={(
                <Button leftSection={<IconSend size={18}/>} onClick={() => setIsComposing(true)}>
                    {t`New message`}
                </Button>
            )}>
                {t`Messages`}
            </PageTitle>
            <p className={classes.intro}>
                <Trans>Messages sent with the “Contact” button on your page and your events. They also arrive by email.</Trans>
            </p>

            <DeviceNotifications/>

            <div className={classes.toolbar}>
                <SegmentedControl
                    value={filter}
                    onChange={(value) => {
                        setFilter(value as 'all' | 'unread');
                        setPage(1);
                    }}
                    data={[
                        {value: 'all', label: t`All`},
                        {value: 'unread', label: unreadCount ? t`Unread (${unreadCount})` : t`Unread`},
                    ]}
                />
                {unreadCount > 0 && (
                    <Button variant="subtle" leftSection={<IconChecks size={18}/>} loading={markAllRead.isPending}
                            onClick={() => markAllRead.mutate({organizerId})}>
                        {t`Mark all as read`}
                    </Button>
                )}
            </div>

            {isLoading && <MessagesSkeleton/>}

            {!isLoading && messages.length === 0 && (
                <Card className={classes.empty}>
                    <IconInbox size={36}/>
                    <strong>{filter === 'unread' ? t`No unread messages` : t`No messages yet`}</strong>
                    <span>{t`When someone uses the “Contact” button on your page or your events, their message appears here.`}</span>
                </Card>
            )}

            {messages.length > 0 && (
                <div className={classes.list}>
                    {messages.map((message) => (
                        <MessageRow
                            key={message.id}
                            message={message}
                            organizerName={organizer?.name}
                            isOpen={openId === message.id}
                            onToggle={() => openId === message.id ? setOpenId(null) : open(message)}
                            onReply={() => setReplyTo(message)}
                        />
                    ))}
                </div>
            )}

            {(data?.meta.last_page ?? 1) > 1 && (
                <Pagination className={classes.pagination} value={page} onChange={setPage}
                            total={data?.meta.last_page ?? 1}/>
            )}

            <ReplyModal message={replyTo} organizerEmail={organizer?.email} onClose={() => setReplyTo(null)}/>
            {(isComposing && organizerId) && (
                <ComposeMessage organizerId={organizerId} onClose={() => setIsComposing(false)}/>
            )}
        </PageBody>
    );
};

export default Messages;
