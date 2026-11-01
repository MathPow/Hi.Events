import {useCallback, useEffect, useRef, useState} from "react";
import {useNavigate} from "react-router";
import {useQueryClient} from "@tanstack/react-query";
import {t} from "@lingui/macro";
import {useLingui} from "@lingui/react";
import {
    addQuestion,
    addText,
    ApiMessage,
    Approval,
    AssistantStatus,
    Block,
    breakText,
    Bubble,
    changeApi,
    fetchStatus,
    load,
    modelTurn,
    newId,
    PANEL_CONVERSATION,
    readApi,
    readLabel,
    repair,
    save,
    withContext,
} from "./assistant.ts";

/**
 * A conversation with the assistant: the model's turns, the tools run in the browser and the
 * changes waiting for approval. Used by the panel (index.tsx) and by the help center, where the
 * answer shows under the question (routes/help/AskAssistant).
 */

export type AssistantBubble = Extract<Bubble, { role: "assistant" }>;

const MAX_TURNS = 25;

export const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const useAssistantConversation = ({userId, storageKey = PANEL_CONVERSATION, canOpenPages = true}: {
    userId: string;
    // Where the conversation is kept for the tab's life (sessionStorage).
    storageKey?: string;
    // The panel follows the person from page to page. The help center's answer lives on its
    // page: there the assistant gives a link instead of opening another page.
    canOpenPages?: boolean;
}) => {
    const [status, setStatus] = useState<AssistantStatus | null>(null);
    const [statusFailed, setStatusFailed] = useState(false);
    const [start] = useState(() => load(userId, storageKey));
    const [api, setApi] = useState<ApiMessage[]>(start.api);
    const [bubbles, setBubbles] = useState<Bubble[]>(start.bubbles);
    const [running, setRunning] = useState(false);
    const controller = useRef<AbortController | null>(null);
    const decisions = useRef(new Map<string, (yes: boolean) => void>());
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const {i18n} = useLingui();

    useEffect(() => {
        if (!running) {
            save(userId, api, bubbles, storageKey);
        }
    }, [userId, api, bubbles, running, storageKey]);

    // Leaving the page stops the answer under way (the panel itself never leaves).
    useEffect(() => () => controller.current?.abort(), []);

    // Key and remaining turns.
    const refreshStatus = useCallback(() => {
        fetchStatus()
            .then((s) => {
                setStatus(s);
                setStatusFailed(false);
            })
            .catch(() => setStatusFailed(true));
    }, []);

    const ready = !!status?.ready && status.remaining > 0;
    const canSend = ready && !running;

    const stop = () => controller.current?.abort();

    const reset = () => {
        controller.current?.abort();
        setApi([]);
        setBubbles([]);
    };

    const decide = (id: string, yes: boolean) => decisions.current.get(id)?.(yes);

    const send = async (raw: string) => {
        const text = raw.trim();
        if (!text || running || !ready) {
            return;
        }
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
                if (!canOpenPages) {
                    return result(`Page non ouverte : la personne lit votre réponse dans le centre d'aide, sous sa question, et la perdrait en changeant de page. Donnez-lui plutôt le lien dans votre réponse, en Markdown : [nom de la page](${path}).`, true);
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
                    // The pages open behind reload their data.
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

    return {status, statusFailed, refreshStatus, ready, canSend, running, bubbles, send, stop, reset, decide};
};
