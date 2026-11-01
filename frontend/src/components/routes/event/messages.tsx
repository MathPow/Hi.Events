import {useParams} from "react-router";
import {useGetEvent} from "../../../queries/useGetEvent.ts";
import {useDisclosure} from "@mantine/hooks";
import {MessageRecipientsModal} from "../../modals/MessageRecipientsModal";
import {Pagination} from "../../common/Pagination";
import {ActionIcon, Button, Tooltip, UnstyledButton} from "@mantine/core";
import {IconArrowLeft, IconClock, IconPaperclip, IconSend, IconX} from "@tabler/icons-react";
import {useFilterQueryParamSync} from "../../../hooks/useFilterQueryParamSync.ts";
import {IdParam, Message, MessageType, QueryFilters} from "../../../types.ts";
import {useGetEventMessages} from "../../../queries/useGetEventMessages.ts";
import {MessageList, messageStatus, messageTimestamp, senderName, typeLabel} from "../../common/MessageList";
import {NoResultsSplash} from "../../common/NoResultsSplash";
import {SendMessageModal} from "../../modals/SendMessageModal";
import {t} from "@lingui/macro";
import React, {useCallback, useEffect, useRef, useState} from "react";
import {dateToBrowserTz, relativeDate} from "../../../utilites/dates.ts";
import {getInitials} from "../../../utilites/helpers.ts";
import {useCancelMessage} from "../../../mutations/useCancelMessage.ts";
import {showError, showSuccess} from "../../../utilites/notifications.tsx";
import {confirmationDialog} from "../../../utilites/confirmationDialog.tsx";
import {PageBody} from "../../common/PageBody";
import {PageTitle} from "../../common/PageTitle";
import {ToolBar} from "../../common/ToolBar";
import {SearchBar} from "../../common/SearchBar";
import {TableSkeleton} from "../../common/TableSkeleton";
import {StatusTag} from "../../common/StatusTag";
import classes from "./messages.module.scss";

const MessagePreview = ({message, eventId, onBack, eventTimezone}: { message: Message; eventId: string; onBack: () => void; eventTimezone: string }) => {
    const [recipientsOpen, {open: openRecipients, close: closeRecipients}] = useDisclosure(false);
    const cancelMutation = useCancelMessage();
    const sender = senderName(message);
    const displayTimestamp = messageTimestamp(message);
    const status = messageStatus(message.status);
    const recipientsAvailable = message.status === 'SENT' || message.status === 'FAILED';

    const handleCancel = () => {
        confirmationDialog(t`Are you sure you want to cancel this scheduled message?`, () => {
            cancelMutation.mutate({
                eventId: eventId as IdParam,
                messageId: message.id as IdParam,
            }, {
                onSuccess: () => showSuccess(t`Message cancelled`),
                onError: () => showError(t`Failed to cancel message`),
            });
        });
    };

    return (
        <>
            <div className={classes.previewHeader}>
                <div className={classes.previewHeaderTop}>
                    <ActionIcon
                        variant="subtle"
                        className={classes.backButton}
                        onClick={onBack}
                        aria-label={t`Back to messages`}
                        title={t`Back to messages`}
                    >
                        <IconArrowLeft size={20}/>
                    </ActionIcon>
                    <StatusTag tone={status.tone}>{status.label}</StatusTag>
                    {message.status === 'SCHEDULED' && message.scheduled_at ? (
                        <span className={classes.previewDate} title={dateToBrowserTz(message.scheduled_at, eventTimezone)}>
                            <IconClock size={16}/>
                            {relativeDate(message.scheduled_at)}
                        </span>
                    ) : (
                        <span className={classes.previewDate}
                              title={displayTimestamp ? dateToBrowserTz(displayTimestamp, eventTimezone) : undefined}>
                            {displayTimestamp ? relativeDate(displayTimestamp) : t`Unknown`}
                        </span>
                    )}
                    {message.status === 'SCHEDULED' && (
                        <Button
                            variant="outline"
                            className={classes.cancelButton}
                            onClick={handleCancel}
                            loading={cancelMutation.isPending}
                            leftSection={<IconX size={16}/>}
                        >
                            {t`Cancel`}
                        </Button>
                    )}
                </div>
                <h2 className={classes.previewSubject}>{message.subject}</h2>
                <div className={classes.previewMeta}>
                    <span className={classes.avatar} aria-hidden>{getInitials(sender)}</span>
                    <div className={classes.previewSenderInfo}>
                        <div className={classes.previewSenderName}>{sender}</div>
                        <div className={classes.previewRecipientType}>
                            {t`To`}:{' '}
                            {recipientsAvailable ? (
                                <UnstyledButton className={classes.recipientLink} onClick={openRecipients}>
                                    {typeLabel(message.type)}
                                </UnstyledButton>
                            ) : (
                                <Tooltip label={t`Recipients are available after the message is sent`} withArrow>
                                    <span className={classes.recipientLinkDisabled} tabIndex={0}>
                                        {typeLabel(message.type)}
                                    </span>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                </div>
                {!!message.attachments?.length && (
                    <div className={classes.attachments} aria-label={t`Attachments`}>
                        {message.attachments.map((attachment) => (
                            <span key={attachment.name} className={classes.attachment}>
                                <IconPaperclip size={14}/>
                                {attachment.name}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            <div
                className={classes.previewContent}
                dangerouslySetInnerHTML={{__html: message.message}}
            />
            {recipientsOpen && (
                <MessageRecipientsModal
                    eventId={eventId}
                    messageId={message.id as IdParam}
                    onClose={closeRecipients}
                />
            )}
        </>
    );
};

/**
 * The emails sent to the attendees of the event: the list on the left (search, status), the open
 * message on the right as a cream card; on phones one at a time, the message with a back arrow.
 */
export const Messages = () => {
    const {eventId} = useParams();
    const {data: event} = useGetEvent(eventId);
    const [searchParams, setSearchParam] = useFilterQueryParamSync();
    const messagesQuery = useGetEventMessages(eventId, searchParams as QueryFilters);
    const messages = messagesQuery?.data?.data;
    const pagination = messagesQuery?.data?.meta;
    const [sendModalOpen, {open: openSendModal, close: closeSendModal}] = useDisclosure(false);
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const [searchValue, setSearchValue] = useState(searchParams.query || '');
    const [mobileShowPreview, setMobileShowPreview] = useState(false);
    const prevMessagesRef = useRef<Message[] | undefined>(undefined);
    const listBodyRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (!messages) return;

        const messagesChanged = messages !== prevMessagesRef.current;
        prevMessagesRef.current = messages;

        if (!messagesChanged) return;

        if (selectedMessage) {
            const updated = messages.find(m => m.id === selectedMessage.id);
            if (updated) {
                setSelectedMessage(updated);
                return;
            }
        }

        setSelectedMessage(messages.length > 0 ? messages[0] : null);
    }, [messages, selectedMessage]);

    const handleSelectMessage = useCallback((message: Message) => {
        setSelectedMessage(message);
        setMobileShowPreview(true);
        // Phones: the message replaces the list, from its top.
        requestAnimationFrame(() => {
            if (window.matchMedia('(max-width: 767px)').matches) {
                previewRef.current?.scrollIntoView({block: 'start'});
            }
        });
    }, []);

    const handleBackToList = useCallback(() => {
        setMobileShowPreview(false);
    }, []);

    const handleSearch = useCallback((value: string) => {
        setSearchValue(value);
        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
        }
        searchTimerRef.current = setTimeout(() => {
            setSearchParam({query: value, pageNumber: 1});
        }, 500);
    }, [setSearchParam]);

    const handleClearSearch = useCallback(() => {
        setSearchValue('');
        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
        }
        setSearchParam({query: '', pageNumber: 1});
    }, [setSearchParam]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!messages?.length || !selectedMessage) return;
        const currentIndex = messages.findIndex(m => m.id === selectedMessage.id);
        if (currentIndex === -1) return;

        let nextIndex: number | null = null;
        if (e.key === 'ArrowDown' && currentIndex < messages.length - 1) {
            nextIndex = currentIndex + 1;
        } else if (e.key === 'ArrowUp' && currentIndex > 0) {
            nextIndex = currentIndex - 1;
        }

        if (nextIndex !== null) {
            e.preventDefault();
            const nextMessage = messages[nextIndex];
            setSelectedMessage(nextMessage);

            const listEl = listBodyRef.current;
            if (listEl) {
                const items = listEl.querySelectorAll<HTMLElement>('[role="option"]');
                items[nextIndex]?.scrollIntoView({block: 'nearest'});
                items[nextIndex]?.focus();
            }
        }
    }, [messages, selectedMessage]);

    const isLoading = !messages || !event;
    const hasSearch = !!searchParams.query;
    const showToolbar = isLoading || hasSearch || !!messages?.length;

    return (
        <PageBody>
            <PageTitle
                subheading={t`Email your attendees, now or later.`}
                actions={(
                    <Button leftSection={<IconSend size={20}/>} onClick={openSendModal}>
                        {t`Compose`}
                    </Button>
                )}
            >{t`Messages`}</PageTitle>

            {showToolbar && (
                <div className={mobileShowPreview ? classes.hiddenOnPhones : undefined}>
                    <ToolBar searchComponent={() => (
                        <SearchBar
                            placeholder={t`Search messages...`}
                            value={searchValue}
                            onChange={(e) => handleSearch(e.currentTarget.value)}
                            onClear={handleClearSearch}
                        />
                    )}/>
                </div>
            )}

            <TableSkeleton isVisible={isLoading}/>

            {!isLoading && messages.length === 0 && (
                <NoResultsSplash
                    heading={t`No messages to show`}
                    icon="courriel"
                    subHeading={
                        <p>{t`Send emails to attendees, ticket holders, or order owners. Messages can be sent immediately or scheduled for later.`}</p>
                    }
                >
                    {!hasSearch && (
                        <Button leftSection={<IconSend size={20}/>} onClick={openSendModal}>
                            {t`Send your first message`}
                        </Button>
                    )}
                </NoResultsSplash>
            )}

            {!isLoading && messages.length > 0 && (
                <div className={`${classes.mailLayout} ${mobileShowPreview ? classes.mobilePreviewActive : ''}`}>
                    <section className={classes.listPanel}>
                        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                        <div className={classes.listBody} ref={listBodyRef} onKeyDown={handleKeyDown}>
                            <MessageList
                                messages={messages}
                                selectedId={selectedMessage?.id}
                                onSelect={handleSelectMessage}
                            />
                        </div>

                        {pagination && Number(pagination.last_page) > 1 && (
                            <div className={classes.listFooter}>
                                <Pagination
                                    value={searchParams.pageNumber}
                                    onChange={(value) => setSearchParam({pageNumber: value})}
                                    total={Number(pagination.last_page)}
                                    size="sm"
                                    marginTop={0}
                                />
                            </div>
                        )}
                    </section>

                    <section className={classes.previewPanel} ref={previewRef}>
                        {selectedMessage ? (
                            <MessagePreview
                                message={selectedMessage}
                                eventId={eventId as string}
                                onBack={handleBackToList}
                                eventTimezone={event?.timezone ?? 'UTC'}
                            />
                        ) : (
                            <p className={classes.previewEmpty}>{t`Select a message to view its contents`}</p>
                        )}
                    </section>
                </div>
            )}

            {sendModalOpen && <SendMessageModal messageType={MessageType.OrderOwner} onClose={closeSendModal}/>}
        </PageBody>
    );
};

export default Messages;
