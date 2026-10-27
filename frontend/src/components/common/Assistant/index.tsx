import {KeyboardEvent, MouseEvent, ReactNode, useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {useLocation, useNavigate} from "react-router";
import {useQueryClient} from "@tanstack/react-query";
import {Button, Loader} from "@mantine/core";
import {IconArrowUp, IconCheck, IconMaximize, IconMinimize, IconPlayerStopFilled, IconRefresh, IconX} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import {useLingui} from "@lingui/react";
import {useGetMe} from "../../../queries/useGetMe.ts";
import {Markdown} from "./Markdown.tsx";
import {
    addQuestion,
    ApiMessage,
    Approval,
    AssistantStatus,
    Block,
    Bubble,
    changeApi,
    fetchStatus,
    load,
    modelTurn,
    newId,
    Piece,
    readApi,
    readLabel,
    repair,
    save,
    withContext,
} from "./assistant.ts";
import classes from "./Assistant.module.scss";

/**
 * The organizer assistant, like the one in the DEHORS console: a chat with
 * Claude, at the bottom right of every back-office page, that reads the
 * ticketing API and proposes changes. Each change shows up as a card to
 * approve and goes out only on a click. The panel can go full screen; the
 * conversation lasts as long as the tab. Logic in assistant.ts, backend in
 * AssistantTurnAction.
 */

type AssistantBubble = Extract<Bubble, { role: "assistant" }>;

const MAX_TURNS = 25;

const readLocal = (key: string) => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};
const writeLocal = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch {
        // localStorage unavailable
    }
};

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

// Mounted once for every back-office page, in the browser only (see router.tsx).
const Assistant = () => {
    const {data: me} = useGetMe();

    return me?.id ? <AssistantPanel userId={String(me.id)}/> : null;
};

export default Assistant;

const AssistantPanel = ({userId}: { userId: string }) => {
    const [open, setOpen] = useState(false);
    const [full, setFull] = useState(() => readLocal("dehors-assistant-full") === "1");
    const [status, setStatus] = useState<AssistantStatus | null>(null);
    const [statusFailed, setStatusFailed] = useState(false);
    const [start] = useState(() => load(userId));
    const [api, setApi] = useState<ApiMessage[]>(start.api);
    const [bubbles, setBubbles] = useState<Bubble[]>(start.bubbles);
    const [input, setInput] = useState("");
    const [running, setRunning] = useState(false);
    const controller = useRef<AbortController | null>(null);
    const decisions = useRef(new Map<string, (yes: boolean) => void>());
    const thread = useRef<HTMLDivElement>(null);
    const field = useRef<HTMLTextAreaElement>(null);
    const navigate = useNavigate();
    const {pathname} = useLocation();
    const queryClient = useQueryClient();
    const {i18n} = useLingui();

    const suggestions = [
        t`How are ticket sales going for my next event?`,
        t`Which orders are waiting for an offline payment?`,
        t`Create a 15% promo code for my next event.`,
    ];

    // Key and remaining turns, at each opening.
    useEffect(() => {
        if (!open) {
            return;
        }
        fetchStatus()
            .then((s) => {
                setStatus(s);
                setStatusFailed(false);
            })
            .catch(() => setStatusFailed(true));
    }, [open]);

    useEffect(() => {
        if (!running) {
            save(userId, api, bubbles);
        }
    }, [userId, api, bubbles, running]);

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
    }, [open, full]);

    // The input grows with the text.
    useEffect(() => {
        const el = field.current;
        if (!el) {
            return;
        }
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [input]);

    const ready = !!status?.ready && status.remaining > 0;

    const toggleFull = () => {
        setFull(!full);
        writeLocal("dehors-assistant-full", full ? "0" : "1");
    };

    const newConversation = () => {
        controller.current?.abort();
        setApi([]);
        setBubbles([]);
        setInput("");
        field.current?.focus();
    };

    const decide = (id: string, yes: boolean) => decisions.current.get(id)?.(yes);

    const send = async (raw: string) => {
        const text = raw.trim();
        if (!text || running || !ready) {
            return;
        }
        setInput("");
        const answerId = newId();
        setBubbles((list) => [
            ...list,
            {id: newId(), role: "user", text},
            {id: answerId, role: "assistant", pieces: [], thinking: "", steps: [], running: true},
        ]);
        const update = (f: (b: AssistantBubble) => AssistantBubble) =>
            setBubbles((list) => list.map((b) => (b.id === answerId && b.role === "assistant" ? f(b) : b)));
        const updateApproval = (id: string, fields: Partial<Approval>) =>
            update((b) => ({...b, pieces: b.pieces.map((p) => (p.type === "approval" && p.id === id ? {...p, ...fields} : p))}));
        const updateStep = (id: string, state: "ok" | "error") =>
            update((b) => ({...b, steps: b.steps.map((s) => (s.id === id ? {...s, state} : s))}));

        const ctrl = new AbortController();
        controller.current = ctrl;
        setRunning(true);

        const execute = async (call: Block): Promise<Block> => {
            const toolInput = (call.input ?? {}) as Record<string, unknown>;
            const result = (content: string, isError = false): Block => ({
                type: "tool_result", tool_use_id: call.id, content, ...(isError ? {is_error: true} : {}),
            });

            if (call.name === "lire_billetterie") {
                const id = newId();
                update((b) => ({...b, steps: [...b.steps, {id, label: readLabel(toolInput.chemin), state: "running"}]}));
                try {
                    const response = await readApi(toolInput.chemin, ctrl.signal);
                    updateStep(id, "ok");
                    return result(response);
                } catch (error) {
                    updateStep(id, "error");
                    return result(errorText(error), true);
                }
            }

            if (call.name === "ouvrir_page") {
                const path = typeof toolInput.chemin === "string" ? toolInput.chemin : "";
                if (!/^\/(manage|account)(\/|$)/.test(path)) {
                    return result("Le chemin doit commencer par /manage ou /account.", true);
                }
                update((b) => ({...b, steps: [...b.steps, {id: newId(), label: t`Opening ${path}`, state: "ok"}]}));
                navigate(path);
                return result("Page ouverte.");
            }

            if (call.name === "modifier_billetterie") {
                const methods = ["POST", "PUT", "PATCH", "DELETE"] as const;
                const approval: Approval = {
                    type: "approval",
                    id: String(call.id),
                    summary: String(toolInput.resume ?? ""),
                    method: methods.find((m) => m === toolInput.methode) ?? "POST",
                    path: String(toolInput.chemin ?? ""),
                    body: toolInput.corps,
                    state: "waiting",
                };
                update((b) => ({...b, pieces: [...b.pieces, approval]}));
                const yes = await new Promise<boolean>((resolve) => {
                    decisions.current.set(approval.id, resolve);
                    ctrl.signal.addEventListener("abort", () => resolve(false), {once: true});
                });
                decisions.current.delete(approval.id);
                if (ctrl.signal.aborted) {
                    updateApproval(approval.id, {state: "cancelled"});
                    return result("Annulé : la personne a arrêté la réponse.", true);
                }
                if (!yes) {
                    updateApproval(approval.id, {state: "refused"});
                    return result("La personne a refusé cette modification. Rien n'a changé.", true);
                }
                updateApproval(approval.id, {state: "sending"});
                try {
                    const response = await changeApi(approval);
                    updateApproval(approval.id, {state: "done"});
                    // The pages open behind the panel reload their data.
                    queryClient.invalidateQueries();
                    return result(response);
                } catch (error) {
                    updateApproval(approval.id, {state: "error", message: errorText(error)});
                    return result(errorText(error), true);
                }
            }

            return result(`Outil inconnu : ${String(call.name)}`, true);
        };

        let conversation = addQuestion(repair(api), withContext(text, i18n.locale));
        setApi(conversation);
        try {
            for (let turn = 0; turn < MAX_TURNS && !ctrl.signal.aborted; turn++) {
                const {content, stopReason} = await modelTurn({
                    messages: conversation,
                    signal: ctrl.signal,
                    onText: (chunk) => update((b) => ({...b, pieces: addText(b.pieces, chunk)})),
                    onThinking: (chunk) => update((b) => ({...b, thinking: b.thinking + chunk})),
                });
                conversation = [...conversation, {role: "assistant", content}];
                setApi(conversation);
                setStatus((s) => (s ? {...s, remaining: Math.max(0, s.remaining - 1)} : s));
                const calls = content.filter((b) => b.type === "tool_use");
                if (stopReason !== "tool_use" || !calls.length) {
                    break;
                }
                const results = await Promise.all(calls.map(execute));
                conversation = [...conversation, {role: "user", content: results}];
                setApi(conversation);
                update((b) => ({...b, pieces: breakText(b.pieces)}));
            }
        } catch (error) {
            if (ctrl.signal.aborted) {
                update((b) => ({...b, stopped: true}));
            } else {
                update((b) => ({...b, error: errorText(error)}));
            }
        } finally {
            conversation = repair(conversation);
            setApi(conversation);
            update((b) => ({...b, running: false}));
            setRunning(false);
            if (controller.current === ctrl) {
                controller.current = null;
            }
        }
    };

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Escape") {
            setOpen(false);
        }
    };

    const link = (href: string, children: ReactNode, key: string) => {
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

    // Event, organizer and admin pages have a tab bar on phones: the button sits above it.
    const withTabBar = /^\/(manage\/(event|organizer)|admin)(\/|$)/.test(pathname);

    const panel = open && (
        <div className={classes.panel} data-full={full} role="dialog" aria-label={t`Assistant`} onKeyDown={onKeyDown}>
            <div className={classes.header}>
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
                <button type="button" className={`${classes.iconButton} ${classes.fullToggle}`} onClick={toggleFull}
                        title={full ? t`Reduce` : t`Full screen`} aria-label={full ? t`Reduce` : t`Full screen`}>
                    {full ? <IconMinimize size={18}/> : <IconMaximize size={18}/>}
                </button>
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
                                <button key={s} type="button" className={classes.suggestion} disabled={!ready} onClick={() => send(s)}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                    {bubbles.map((b) =>
                        b.role === "user"
                            ? <div key={b.id} className={classes.question}>{b.text}</div>
                            : <Answer key={b.id} bubble={b} link={link} decide={decide}/>,
                    )}
                </div>
            </div>

            <div className={classes.composer}>
                <div className={classes.column}>
                    <div className={classes.field}>
                        <textarea ref={field} rows={1} value={input} placeholder={t`Write your request…`}
                                  aria-label={t`Your request`} disabled={!ready}
                                  onChange={(e) => setInput(e.target.value)}
                                  onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                                          e.preventDefault();
                                          send(input);
                                      }
                                  }}/>
                        {running ? (
                            <button type="button" className={classes.send} onClick={() => controller.current?.abort()}
                                    title={t`Stop`} aria-label={t`Stop`}>
                                <IconPlayerStopFilled size={16}/>
                            </button>
                        ) : (
                            <button type="button" className={classes.send} disabled={!input.trim() || !ready}
                                    onClick={() => send(input)} title={t`Send`} aria-label={t`Send`}>
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
                <span className={classes.launcherIcon} aria-hidden="true"/>
            </button>
        </>,
        document.body,
    );
};

function addText(pieces: Piece[], text: string): Piece[] {
    const last = pieces[pieces.length - 1];
    if (last?.type === "text") {
        return [...pieces.slice(0, -1), {type: "text", text: last.text + text}];
    }
    return [...pieces, {type: "text", text}];
}

/** Between two turns, the text that follows starts a new paragraph. */
function breakText(pieces: Piece[]): Piece[] {
    const last = pieces[pieces.length - 1];
    if (last?.type !== "text" || !last.text || last.text.endsWith("\n\n")) {
        return pieces;
    }
    return [...pieces.slice(0, -1), {type: "text", text: `${last.text}\n\n`}];
}

const Answer = ({bubble, link, decide}: {
    bubble: AssistantBubble;
    link: (href: string, children: ReactNode, key: string) => ReactNode;
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
