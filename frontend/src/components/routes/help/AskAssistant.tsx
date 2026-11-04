import {t} from "@lingui/macro";
import {TextInput} from "@mantine/core";
import {Dispatch, FormEvent, ReactNode, SetStateAction, useEffect, useId, useRef, useState} from "react";
import {useNavigate} from "react-router";
import {useGetMe} from "../../../queries/useGetMe.ts";
import {returnHereAfterLogin} from "../../../api/client.ts";
import {Answer, useAnswerLink} from "../../common/Assistant/Answer.tsx";
import {useAssistantConversation} from "../../common/Assistant/useAssistantConversation.ts";
import assistant from "../../common/Assistant/Assistant.module.scss";
import shell from "../../layouts/OrganizerHomepage/OrganizerHomepage.module.scss";
import classes from "./Help.module.scss";

// The help center's conversation, apart from the panel's (it lasts as long as the tab).
const HELP_CONVERSATION = "dehors-assistant-help";

/**
 * Asks the organizer assistant (components/common/Assistant) from the help center: signed in,
 * the answer shows right under the question, in the box; otherwise the login comes first, then
 * this page again, the question still in the field.
 */
export const AskAssistant = ({title}: { title?: string }) => {
    const me = useGetMe();
    const userId = me.isSuccess && me.data?.id ? String(me.data.id) : null;

    return userId
        ? <SignedInAsk key={userId} userId={userId} title={title}/>
        : <SignedOutAsk title={title}/>;
};

// Back from the login, the question asked before it is in the field.
const useQuestionField = (): [string, Dispatch<SetStateAction<string>>] => {
    const [question, setQuestion] = useState('');
    useEffect(() => {
        const asked = new URLSearchParams(window.location.search).get('question');
        if (asked) {
            setQuestion(asked);
        }
    }, []);
    return [question, setQuestion];
};

const SignedOutAsk = ({title}: { title?: string }) => {
    const navigate = useNavigate();
    const [question, setQuestion] = useQuestionField();

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const asked = question.trim();
        if (!asked) {
            return;
        }
        returnHereAfterLogin(`${window.location.pathname}?question=${encodeURIComponent(asked)}`);
        navigate('/auth/login');
    };

    return (
        <AskCard title={title} question={question} onQuestion={setQuestion} onSubmit={submit}
                 text={t`It knows Billetterie Dehors and can read your events and orders. Sign in to your organizer account to ask it.`}
                 action={(
                     <button type="submit" className={`${shell.button} ${shell.buttonFilled} ${classes.askButton}`}
                             data-rough="button">
                         {t`Sign in to ask`}
                     </button>
                 )}/>
    );
};

const SignedInAsk = ({userId, title}: { userId: string, title?: string }) => {
    const [question, setQuestion] = useQuestionField();
    const link = useAnswerLink();
    const {status, statusFailed, refreshStatus, ready, canSend, running, bubbles, send, stop, reset, decide, respond} =
        useAssistantConversation({userId, storageKey: HELP_CONVERSATION, canOpenPages: false});
    const lastQuestion = useRef<HTMLDivElement>(null);
    const justAsked = useRef(false);
    const lastQuestionIndex = bubbles.map((b) => b.role).lastIndexOf('user');

    useEffect(() => {
        refreshStatus();
    }, [refreshStatus]);

    // A new question comes into view, its answer under it.
    useEffect(() => {
        if (justAsked.current) {
            justAsked.current = false;
            lastQuestion.current?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
        }
    }, [lastQuestionIndex]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const asked = question.trim();
        if (!asked || !canSend) {
            return;
        }
        justAsked.current = true;
        setQuestion('');
        send(asked);
    };

    const remaining = status?.remaining ?? 0;
    const notice = statusFailed
        ? t`The assistant can't be reached right now.`
        : status && !status.ready
            ? t`The assistant is not available yet.`
            : status && remaining <= 0
                ? t`The assistant has reached its daily limit for this account. It will be back tomorrow.`
                : null;

    return (
        <AskCard title={title} question={question} onQuestion={setQuestion} onSubmit={submit}
                 text={t`It knows Billetterie Dehors and your account: it reads your events and orders, and only changes something once you approve it.`}
                 action={running ? (
                     <button type="button" onClick={stop}
                             className={`${shell.button} ${shell.buttonOutline} ${classes.askButton}`} data-rough="button">
                         {t`Stop`}
                     </button>
                 ) : (
                     <button type="submit" disabled={!ready}
                             className={`${shell.button} ${shell.buttonFilled} ${classes.askButton}`} data-rough="button">
                         {t`Ask`}
                     </button>
                 )}>
            {(notice || bubbles.length > 0) && (
                <div className={classes.askThread}>
                    {notice && <p className={assistant.error}>{notice}</p>}
                    {bubbles.map((b, index) => b.role === 'user' ? (
                        <div key={b.id} ref={index === lastQuestionIndex ? lastQuestion : undefined}
                             className={`${assistant.question} ${classes.askQuestion}`}>
                            {b.text}
                        </div>
                    ) : (
                        <Answer key={b.id} bubble={b} link={link} decide={decide} respond={respond}/>
                    ))}
                    {bubbles.length > 0 && (
                        <div className={classes.askFooter}>
                            <span>{t`The assistant can make mistakes: check its answers.`}</span>
                            {status && remaining > 0 && remaining <= 20 && (
                                <span>{t`${remaining} requests left today`}</span>
                            )}
                            <button type="button" className={classes.askReset} onClick={reset}>
                                {t`New conversation`}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </AskCard>
    );
};

const AskCard = ({title, text, question, onQuestion, onSubmit, action, children}: {
    title?: string;
    text: string;
    question: string;
    onQuestion: (question: string) => void;
    onSubmit: (event: FormEvent) => void;
    action: ReactNode;
    children?: ReactNode;
}) => {
    const id = useId();

    return (
        <section className={`${shell.card} ${classes.ask}`} data-rough aria-labelledby={id}>
            <span className={classes.askIcon} aria-hidden="true"/>
            <div className={classes.askText}>
                <h2 id={id} className={classes.askTitle}>{title ?? t`Ask the assistant`}</h2>
                <p>{text}</p>
            </div>
            <form className={classes.askForm} onSubmit={onSubmit}>
                <TextInput value={question} onChange={(event) => onQuestion(event.currentTarget.value)}
                           placeholder={t`E.g. How do I refund an order?`} aria-label={t`Your question`}
                           classNames={{root: classes.askField, input: classes.askInput}}/>
                {action}
            </form>
            {children}
        </section>
    );
};
