import {MouseEvent, ReactNode} from "react";
import {useNavigate} from "react-router";
import {Button, Loader} from "@mantine/core";
import {IconCheck} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import {Markdown} from "./Markdown.tsx";
import {Approval} from "./assistant.ts";
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

/** One answer of the assistant: its steps, its text and the changes to approve. */
export const Answer = ({bubble, link, decide}: {
    bubble: AssistantBubble;
    link: LinkRenderer;
    decide: (id: string, yes: boolean) => void;
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
