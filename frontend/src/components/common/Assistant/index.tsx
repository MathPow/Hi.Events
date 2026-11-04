import {KeyboardEvent, useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {useLocation} from "react-router";
import {IconArrowUp, IconPlayerStopFilled, IconRefresh, IconX} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import {useGetMe} from "../../../queries/useGetMe.ts";
import {Answer, useAnswerLink} from "./Answer.tsx";
import {useAssistantConversation} from "./useAssistantConversation.ts";
import {onAssistantToggle, publishAssistantState, takeOpenRequest} from "../../../utilites/assistantEvents.ts";
import classes from "./Assistant.module.scss";

/**
 * The organizer assistant, like the one in the DEHORS console: a chat with
 * Claude, at the bottom right of every back-office page, that reads the
 * ticketing API and proposes changes. Each change shows up as a card to
 * approve and goes out only on a click. The conversation lasts as long as the tab. Conversation in useAssistantConversation.ts,
 * calls and tools in assistant.ts, backend in AssistantTurnAction.
 */

// Mounted once for every back-office page, in the browser only (see router.tsx).
const Assistant = () => {
    const {data: me} = useGetMe();

    return me?.id ? <AssistantPanel userId={String(me.id)}/> : null;
};

export default Assistant;

const AssistantPanel = ({userId}: { userId: string }) => {
    const [open, setOpen] = useState(takeOpenRequest);
    const [input, setInput] = useState("");
    const thread = useRef<HTMLDivElement>(null);
    const field = useRef<HTMLTextAreaElement>(null);
    const {pathname} = useLocation();
    const link = useAnswerLink();
    const {status, statusFailed, refreshStatus, ready, canSend, running, awaitingAnswer, bubbles, send, stop, reset, decide, respond} =
        useAssistantConversation({userId});

    const suggestions = [
        t`How are ticket sales going for my next event?`,
        t`Which orders are waiting for an offline payment?`,
        t`Create a 15% promo code for my next event.`,
    ];

    // The « Assistant » tab of the phone's tab bar opens and closes it, and shows its state.
    useEffect(() => onAssistantToggle(() => setOpen((value) => !value)), []);
    useEffect(() => {
        publishAssistantState({available: true, open, busy: running});
    }, [open, running]);
    useEffect(() => () => publishAssistantState({available: false, open: false, busy: false}), []);

    // Key and remaining turns, at each opening.
    useEffect(() => {
        if (open) {
            refreshStatus();
        }
    }, [open, refreshStatus]);

    // The thread follows the answer while scrolled to the bottom.
    useEffect(() => {
        const el = thread.current;
        if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) {
            el.scrollTop = el.scrollHeight;
        }
    }, [bubbles]);

    useEffect(() => {
        if (open) {
            field.current?.focus();
        }
    }, [open]);

    // The input grows with the text.
    useEffect(() => {
        const el = field.current;
        if (!el) {
            return;
        }
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [input]);

    const newConversation = () => {
        reset();
        setInput("");
        field.current?.focus();
    };

    const submit = (text: string) => {
        if (!text.trim() || !canSend) {
            return;
        }
        setInput("");
        send(text);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Escape") {
            setOpen(false);
        }
    };

    // Event, organizer and admin pages have a tab bar on phones: the button sits above it.
    const withTabBar = /^\/(manage\/(event|organizer)|admin)(\/|$)/.test(pathname);

    const panel = open && (
        <div className={classes.panel} role="dialog" aria-label={t`Assistant`} onKeyDown={onKeyDown}>
            <div className={classes.header}>
                <img className={classes.headerMascot} src={'/interface/admin/stagiaire.svg'} width={21} height={24} alt=""
                     aria-hidden/>
                <strong className={classes.title}>{t`Assistant`}</strong>
                {status && status.remaining <= 20 && (
                    <span className={classes.remaining}>{t`${status.remaining} requests left today`}</span>
                )}
                {bubbles.length > 0 && (
                    <button type="button" className={classes.iconButton} onClick={newConversation}
                            title={t`New conversation`} aria-label={t`New conversation`}>
                        <IconRefresh size={18}/>
                    </button>
                )}
                <button type="button" className={classes.iconButton} onClick={() => setOpen(false)}
                        title={t`Close`} aria-label={t`Close`}>
                    <IconX size={18}/>
                </button>
            </div>

            <div ref={thread} className={classes.thread}>
                <div className={classes.column}>
                    {statusFailed && <p className={classes.error}>{t`The assistant can't be reached right now.`}</p>}
                    {status && !status.ready && <p className={classes.error}>{t`The assistant is not available yet.`}</p>}
                    {status?.ready && status.remaining <= 0 && (
                        <p className={classes.error}>{t`The assistant has reached its daily limit for this account. It will be back tomorrow.`}</p>
                    )}
                    {bubbles.length === 0 && (
                        <div className={classes.empty}>
                            <p>{t`Ask me to look something up in your ticketing or to change it. I show you every change before making it.`}</p>
                            {suggestions.map((s) => (
                                <button key={s} type="button" className={classes.suggestion} disabled={!ready} onClick={() => submit(s)}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                    {bubbles.map((b) =>
                        b.role === "user"
                            ? <div key={b.id} className={classes.question}>{b.text}</div>
                            : <Answer key={b.id} bubble={b} link={link} decide={decide} respond={respond}/>,
                    )}
                </div>
            </div>

            <div className={classes.composer}>
                <div className={classes.column}>
                    <div className={classes.field}>
                        <textarea ref={field} rows={1} value={input} placeholder={awaitingAnswer ? t`Write your answer…` : t`Write your request…`}
                                  aria-label={t`Your request`} disabled={!ready}
                                  onChange={(e) => setInput(e.target.value)}
                                  onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                                          e.preventDefault();
                                          submit(input);
                                      }
                                  }}/>
                        {running && !(awaitingAnswer && input.trim()) ? (
                            <button type="button" className={classes.send} onClick={stop}
                                    title={t`Stop`} aria-label={t`Stop`}>
                                <IconPlayerStopFilled size={16}/>
                            </button>
                        ) : (
                            <button type="button" className={classes.send} disabled={!input.trim() || !ready}
                                    onClick={() => submit(input)} title={t`Send`} aria-label={t`Send`}>
                                <IconArrowUp size={18}/>
                            </button>
                        )}
                    </div>
                    <p className={classes.disclaimer}>{t`The assistant can make mistakes: check its answers.`}</p>
                </div>
            </div>
        </div>
    );

    return createPortal(
        <>
            {panel}
            <button type="button" className={classes.launcher} data-open={open} data-busy={running}
                    data-tab-bar={withTabBar} onClick={() => setOpen(!open)} aria-expanded={open}
                    title={open ? t`Close the assistant` : t`Assistant`}
                    aria-label={open ? t`Close the assistant` : t`Open the assistant`}>
                <img className={classes.launcherIcon} src={'/interface/admin/stagiaire.svg'} width={27} height={32}
                     alt="" aria-hidden/>
            </button>
        </>,
        document.body,
    );
};
