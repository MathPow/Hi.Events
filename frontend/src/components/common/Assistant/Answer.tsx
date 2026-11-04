import {FormEvent, MouseEvent, ReactNode, useState} from "react";
import {useNavigate} from "react-router";
import {Button, Loader} from "@mantine/core";
import {IconArrowUp, IconCheck, IconRefresh} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import {Markdown} from "./Markdown.tsx";
import {Approval, Question} from "./assistant.ts";
import {AssistantBubble} from "./useAssistantConversation.ts";
import classes from "./Assistant.module.scss";

type LinkRenderer = (href: string, children: ReactNode, key: string) => ReactNode;

/** The links of an answer: the app's own pages open in place, the others in a new tab. */
export const useAnswerLink = (): LinkRenderer => {
    const navigate = useNavigate();

    return (href, children, key) => {
        const internal = href.startsWith("/") && !href.startsWith("//");
        if (internal) {
            return (
                <a key={key} href={href} onClick={(e: MouseEvent) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey) {
                        return;
                    }
                    e.preventDefault();
                    navigate(href);
                }}>{children}</a>
            );
        }
        if (/^https?:\/\//.test(href)) {
            return <a key={key} href={href} target="_blank" rel="noreferrer">{children}</a>;
        }
        return <span key={key}>{children}</span>;
    };
};

/** A question of the assistant: its choices as buttons, or the person's own answer. */
const QuestionCard = ({question, respond}: {
    question: Question;
    respond: (id: string, answer: string | null) => void;
}) => {
    const [other, setOther] = useState("");
    const waiting = question.state === "waiting";

    const submitOther = (event: FormEvent) => {
        event.preventDefault();
        if (other.trim()) {
            respond(question.id, other.trim());
        }
    };

    return (
        <div className={classes.questionCard} data-state={question.state}>
            <p className={classes.approvalTitle}>{t`Question`}</p>
            <p className={classes.questionText}>{question.question}</p>
            {waiting ? (
                <>
                    <div className={classes.choices}>
                        {question.choices.map((choice, index) => (
                            <button key={index} type="button" className={classes.choice}
                                    onClick={() => respond(question.id, choice.label)}>
                                <span className={classes.choiceNumber} aria-hidden>{index + 1}</span>
                                <span className={classes.choiceText}>
                                    <span className={classes.choiceLabel}>{choice.label}</span>
                                    {choice.detail && <span className={classes.choiceDetail}>{choice.detail}</span>}
                                </span>
                            </button>
                        ))}
                    </div>
                    <form className={classes.otherAnswer} onSubmit={submitOther}>
                        <input value={other} onChange={(e) => setOther(e.target.value)}
                               placeholder={t`Or write your own answer…`} aria-label={t`Your own answer`}/>
                        <button type="submit" className={classes.otherSend} disabled={!other.trim()}
                                title={t`Send`} aria-label={t`Send`}>
                            <IconArrowUp size={16}/>
                        </button>
                    </form>
                    <button type="button" className={classes.skip} onClick={() => respond(question.id, null)}>
                        {t`Skip`}
                    </button>
                </>
            ) : (
                <p className={classes.note}>
                    {question.state === "answered" && <><IconCheck size={14}/> <strong className={classes.questionAnswer}>{question.answer}</strong></>}
                    {question.state === "skipped" && t`Skipped.`}
                    {question.state === "cancelled" && t`Not answered.`}
                </p>
            )}
        </div>
    );
};

/** One answer of the assistant: its steps, its text, its questions and the changes to approve. */
export const Answer = ({bubble, link, decide, respond}: {
    bubble: AssistantBubble;
    link: LinkRenderer;
    decide: (id: string, yes: boolean) => void;
    respond: (id: string, answer: string | null) => void;
}) => {
    const waiting = bubble.pieces.filter((p): p is Approval => p.type === "approval" && p.state === "waiting");
    const lastStep = bubble.steps[bubble.steps.length - 1];
    const work = bubble.steps.length > 0 || bubble.thinking;
    const nothing = !bubble.pieces.length && !work;

    const stateText: Record<Approval["state"], string> = {
        waiting: "",
        sending: t`Sending…`,
        done: t`Done`,
        refused: t`Refused: nothing changed.`,
        cancelled: t`Cancelled: nothing changed.`,
        error: t`The ticketing refused:`,
        unreachable: t`The ticketing isn't answering right now (it may be restarting). Nothing has changed yet.`,
    };

    return (
        <div className={classes.answer}>
            {work && (
                <details className={classes.work}>
                    <summary>
                        {bubble.running && (lastStep?.state === "running" || !bubble.pieces.length)
                            ? <Loader size={12} color="currentColor"/>
                            : <IconCheck size={14}/>}
                        {bubble.running && lastStep?.state === "running"
                            ? lastStep.label
                            : bubble.steps.length
                                ? (bubble.steps.length > 1 ? t`${bubble.steps.length} steps` : t`1 step`)
                                : t`Thinking`}
                    </summary>
                    {bubble.steps.length > 0 && (
                        <ul>
                            {bubble.steps.map((s) => <li key={s.id} data-state={s.state}>{s.label}</li>)}
                        </ul>
                    )}
                    {bubble.thinking && <p className={classes.thinking}>{bubble.thinking}</p>}
                </details>
            )}
            {nothing && bubble.running && (
                <p className={classes.pending}><Loader size={12} color="currentColor"/> {t`Looking…`}</p>
            )}

            {bubble.pieces.map((p, i) =>
                p.type === "text" ? (
                    <div key={i} className={classes.markdown}><Markdown text={p.text} link={link}/></div>
                ) : p.type === "question" ? (
                    <QuestionCard key={p.id} question={p} respond={respond}/>
                ) : (
                    <div key={p.id} className={classes.approval} data-state={p.state} data-method={p.method}>
                        <p className={classes.approvalTitle}>
                            {p.method === "DELETE" ? t`Deletion to approve` : t`Change to approve`}
                        </p>
                        <p>{p.summary}</p>
                        <details>
                            <summary>{p.method} {p.path}</summary>
                            {p.body !== undefined && <pre>{JSON.stringify(p.body, null, 2)}</pre>}
                        </details>
                        {p.state === "waiting" ? (
                            <div className={classes.actions}>
                                <Button size="xs" color={p.method === "DELETE" ? "red" : undefined} onClick={() => decide(p.id, true)}>
                                    {p.method === "DELETE" ? t`Delete` : t`Approve`}
                                </Button>
                                <Button size="xs" variant="default" onClick={() => decide(p.id, false)}>{t`Refuse`}</Button>
                            </div>
                        ) : p.state === "unreachable" ? (
                            <>
                                <p className={classes.error}>{stateText.unreachable}</p>
                                {p.message && <p className={classes.note}>{p.message}</p>}
                                <div className={classes.actions}>
                                    <Button size="xs" leftSection={<IconRefresh size={14}/>} onClick={() => decide(p.id, true)}>
                                        {t`Retry`}
                                    </Button>
                                    <Button size="xs" variant="default" onClick={() => decide(p.id, false)}>{t`Give up`}</Button>
                                </div>
                            </>
                        ) : (
                            <p className={p.state === "error" ? classes.error : classes.note}>
                                {p.state === "sending" && <Loader size={12} color="currentColor"/>}
                                {p.state === "done" && <IconCheck size={14}/>}
                                {stateText[p.state]} {p.message}
                            </p>
                        )}
                    </div>
                ),
            )}

            {waiting.length > 1 && (
                <div className={classes.actions}>
                    <Button size="xs" onClick={() => waiting.forEach((p) => decide(p.id, true))}>
                        {t`Approve all (${waiting.length})`}
                    </Button>
                    <Button size="xs" variant="default" onClick={() => waiting.forEach((p) => decide(p.id, false))}>
                        {t`Refuse all`}
                    </Button>
                </div>
            )}
            {bubble.error && <p className={classes.error}>{bubble.error}</p>}
            {bubble.stopped && <p className={classes.note}>{t`Stopped.`}</p>}
        </div>
    );
};
