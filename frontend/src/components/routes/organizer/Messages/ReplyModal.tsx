import {t} from "@lingui/macro";
import {useState} from "react";
import {useParams} from "react-router";
import {Button, Modal, Textarea} from "@mantine/core";
import {useMediaQuery} from "@mantine/hooks";
import {IconSend} from "@tabler/icons-react";
import {OrganizerMessage} from "../../../../api/organizerMessage.client.ts";
import {useReplyToOrganizerMessage} from "../../../../mutations/useOrganizerMessageMutations.ts";
import {showError, showSuccess} from "../../../../utilites/notifications.tsx";
import classes from "./Messages.module.scss";

const MAX_LENGTH = 5000;

/**
 * « Répondre »: the person's address is already there, their message just above; the organizer
 * only writes the answer. Full screen on phones (it opens from a notification).
 */
export const ReplyModal = ({message, organizerEmail, onClose}: {
    message: OrganizerMessage | null,
    organizerEmail?: string,
    onClose: () => void,
}) => {
    const {organizerId} = useParams();
    const isPhone = useMediaQuery('(max-width: 48em)');
    const reply = useReplyToOrganizerMessage();
    const [text, setText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const name = message?.sender_name ?? '';

    const close = () => {
        setText('');
        setError(null);
        onClose();
    };

    const send = () => {
        if (!message || !text.trim()) {
            setError(t`Write your answer first.`);
            return;
        }
        reply.mutate({organizerId, messageId: message.id, reply: text}, {
            onSuccess: () => {
                showSuccess(t`Answer sent to ${name}`);
                close();
            },
            onError: (exception: any) => {
                const serverMessage = exception?.response?.status === 422 ? exception?.response?.data?.message : null;
                showError(exception?.response?.status === 429
                    ? t`Too many answers in a row. Please try again in a few minutes.`
                    : serverMessage || t`The answer could not be sent. Please try again.`);
            },
        });
    };

    return (
        <Modal
            opened={!!message}
            onClose={close}
            title={t`Reply to ${name}`}
            size="lg"
            radius={isPhone ? 0 : 'xl'}
            fullScreen={!!isPhone}
            classNames={{title: classes.replyTitle, body: classes.replyBody}}
        >
            {message && (
                <>
                    <div className={classes.replyTo}>
                        <span className={classes.replyLabel}>{t`To`}</span>
                        <span className={classes.replyRecipient}>
                            <strong>{message.sender_name}</strong>
                            <span>{message.sender_email}</span>
                        </span>
                    </div>

                    <blockquote className={classes.replyQuote}>
                        <span className={classes.replyLabel}>{t`Their message`}</span>
                        <p>{message.message}</p>
                    </blockquote>

                    <Textarea
                        className={classes.replyField}
                        label={t`Your answer`}
                        placeholder={t`Hello ${name},`}
                        autosize
                        minRows={isPhone ? 8 : 6}
                        maxRows={14}
                        maxLength={MAX_LENGTH}
                        data-autofocus
                        value={text}
                        error={error}
                        onChange={(event) => {
                            setText(event.currentTarget.value);
                            setError(null);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                                send();
                            }
                        }}
                    />

                    {organizerEmail && (
                        <p className={classes.replyHint}>
                            {t`If ${name} answers back, it arrives at ${organizerEmail}.`}
                        </p>
                    )}

                    <div className={classes.replyActions}>
                        <Button variant="subtle" onClick={close}>{t`Cancel`}</Button>
                        <Button leftSection={<IconSend size={18}/>} loading={reply.isPending} onClick={send}>
                            {t`Send`}
                        </Button>
                    </div>
                </>
            )}
        </Modal>
    );
};
