import {t} from "@lingui/macro";
import {getConfig} from "../../../utilites/config.ts";

/**
 * The organizer assistant, browser side: the conversation, the call to the
 * backend (POST /assistant) and the tools.
 *
 * The tools run here, with the signed-in organizer's own session: a read of
 * the API goes out on its own, a change waits for approval in the panel. The
 * backend only sees the conversation, so the assistant never has more rights
 * than the person using it.
 */

/** A block of an Anthropic API message, kept as is (signed thinking included). */
export type Block = { type: string; [key: string]: unknown };
export type ApiMessage = { role: "user" | "assistant"; content: string | Block[] };

export type Step = { id: string; label: string; state: "running" | "ok" | "error" };

export type Approval = {
    type: "approval";
    id: string;
    summary: string;
    method: "POST" | "PUT" | "PATCH" | "DELETE";
    path: string;
    body?: unknown;
    state: "waiting" | "sending" | "done" | "refused" | "cancelled" | "error";
    message?: string;
};
export type Piece = { type: "text"; text: string } | Approval;

export type Bubble =
    | { id: string; role: "user"; text: string }
    | {
    id: string;
    role: "assistant";
    pieces: Piece[];
    thinking: string;
    steps: Step[];
    running: boolean;
    error?: string;
    stopped?: boolean;
};

export type AssistantStatus = { ready: boolean; model: string; remaining: number; limit: number };

export const newId = () => Math.random().toString(36).slice(2, 10);

const apiUrl = (path: string) => `${getConfig("VITE_API_URL_CLIENT")}${path}`;

export async function fetchStatus(): Promise<AssistantStatus> {
    const response = await fetch(apiUrl("/assistant"), {credentials: "include", headers: {Accept: "application/json"}});
    if (!response.ok) {
        throw new Error(String(response.status));
    }
    return response.json();
}

/** One model turn: the text streams in, then the complete message. */
export async function modelTurn(options: {
    messages: ApiMessage[];
    signal: AbortSignal;
    onText: (text: string) => void;
    onThinking: (text: string) => void;
}): Promise<{ content: Block[]; stopReason: string }> {
    const {messages, signal, onText, onThinking} = options;
    const response = await fetch(apiUrl("/assistant"), {
        method: "POST",
        credentials: "include",
        headers: {"Content-Type": "application/json", Accept: "application/x-ndjson, application/json"},
        body: JSON.stringify({messages}),
        signal,
    });
    if (!response.ok || !response.body) {
        const {message} = await response.json().catch(() => ({message: ""}));
        throw new Error(message || t`The server answered ${response.status}.`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let final: { content: Block[]; stopReason: string } | undefined;
    for (; ;) {
        const {done, value} = await reader.read();
        if (done) {
            break;
        }
        buffer += decoder.decode(value, {stream: true});
        let i: number;
        while ((i = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, i).trim();
            buffer = buffer.slice(i + 1);
            if (!line) {
                continue;
            }
            const event = JSON.parse(line);
            if (event.type === "texte") {
                onText(event.texte);
            } else if (event.type === "reflexion") {
                onThinking(event.texte);
            } else if (event.type === "erreur") {
                throw new Error(event.texte);
            } else if (event.type === "fin") {
                final = {content: event.contenu, stopReason: event.arret};
            }
        }
    }
    if (!final) {
        throw new Error(t`The answer stopped halfway. Please try again.`);
    }
    return final;
}

// --- Tools

/** Past this, an API response is cut: the model must ask for less. */
const LIMIT = 40_000;

const truncate = (text: string) =>
    text.length <= LIMIT
        ? text
        : `${text.slice(0, LIMIT)}\n… (réponse coupée à ${LIMIT} caractères sur ${text.length} : demandez moins, avec per_page, page, query ou filter_fields)`;

/** Same list as the backend (AssistantRoutes): login, app tokens, super admin, public pages and the assistant itself. */
const BLOCKED_PREFIXES = ["/auth", "/api-tokens", "/admin", "/public", "/assistant"];

export function checkPath(path: unknown): string {
    if (typeof path !== "string") {
        throw new Error("Le chemin doit être du texte.");
    }
    const bare = path.split("?")[0];
    if (!bare.startsWith("/") || bare.startsWith("//") || bare.includes("..") || bare.includes("\\")) {
        throw new Error("Le chemin doit commencer par / et rester dans l'API de la billetterie.");
    }
    if (BLOCKED_PREFIXES.some((prefix) => bare === prefix || bare.startsWith(`${prefix}/`))) {
        throw new Error("Cette partie de l'API n'est pas ouverte à l'assistant.");
    }
    return path;
}

async function readResponse(response: Response): Promise<string> {
    const type = response.headers.get("Content-Type") ?? "";
    if (!/json|text/.test(type) && response.status !== 204) {
        const size = (await response.blob()).size;
        return `Fichier ${type || "sans type"} de ${size} octets : la personne peut l'ouvrir depuis la page.`;
    }
    return response.text();
}

export async function readApi(path: unknown, signal: AbortSignal): Promise<string> {
    const response = await fetch(apiUrl(checkPath(path)), {credentials: "include", headers: {Accept: "application/json"}, signal});
    const text = await readResponse(response);
    if (!response.ok) {
        throw new Error(`L'API a répondu ${response.status} : ${text.slice(0, 3000)}`);
    }
    return truncate(text);
}

export async function changeApi(approval: Approval): Promise<string> {
    const withBody = approval.method !== "DELETE";
    const response = await fetch(apiUrl(checkPath(approval.path)), {
        method: approval.method,
        credentials: "include",
        headers: {Accept: "application/json", ...(withBody ? {"Content-Type": "application/json"} : {})},
        body: withBody ? JSON.stringify(approval.body ?? {}) : undefined,
    });
    const text = await readResponse(response);
    if (!response.ok) {
        throw new Error(`L'API a répondu ${response.status} : ${text.slice(0, 3000)}`);
    }
    return truncate(text || `${response.status} OK`);
}

/** What a read does, in words: "Reading: orders". */
export function readLabel(path: unknown): string {
    if (typeof path !== "string") {
        return t`Reading`;
    }
    const segments = path.split("?")[0].split("/").filter((segment) => segment && !/^\d+$/.test(segment));
    const resource = segments[segments.length - 1] ?? "";
    const names: Record<string, string> = {
        events: t`events`,
        organizers: t`organizers`,
        orders: t`orders`,
        attendees: t`attendees`,
        products: t`tickets and products`,
        "product-categories": t`ticket categories`,
        "promo-codes": t`promo codes`,
        questions: t`questions`,
        messages: t`messages`,
        "check-in-lists": t`check-in lists`,
        "capacity-assignments": t`capacity assignments`,
        affiliates: t`affiliates`,
        settings: t`settings`,
        stats: t`statistics`,
        waitlist: t`waitlist`,
        users: t`users`,
        me: t`your profile`,
        accounts: t`account`,
        "taxes-and-fees": t`taxes and fees`,
        webhooks: t`webhooks`,
        "email-templates": t`email templates`,
        deposits: t`deposits`,
        images: t`images`,
    };
    const name = names[resource] ?? (resource || t`the API`);
    return segments.includes("reports") ? t`Reading: report` : t`Reading: ${name}`;
}

// --- The context of the moment, sent with each message of the person

export function withContext(text: string, locale: string): string {
    const now = new Date().toLocaleString(locale, {dateStyle: "full", timeStyle: "short"});
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return [
        "<contexte>",
        `Maintenant : ${now} (${timeZone}).`,
        `Page ouverte : ${window.location.pathname}${window.location.search} (« ${document.title} »).`,
        `Langue de l'interface : ${locale}.`,
        "</contexte>",
        "",
        text,
    ].join("\n");
}

// --- The conversation, kept for the tab's life

const KEY = "dehors-assistant-conversation";

export function load(userId: string): { api: ApiMessage[]; bubbles: Bubble[] } {
    try {
        const raw = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
        if (!raw || raw.userId !== userId || !Array.isArray(raw.api) || !Array.isArray(raw.bubbles)) {
            return {api: [], bubbles: []};
        }
        // An approval left waiting can't resume after a reload.
        const bubbles = (raw.bubbles as Bubble[]).map((b) =>
            b.role === "assistant"
                ? {
                    ...b,
                    running: false,
                    steps: b.steps.map((s) => (s.state === "running" ? {...s, state: "error" as const} : s)),
                    pieces: b.pieces.map((p) => (p.type === "approval" && (p.state === "waiting" || p.state === "sending") ? {
                        ...p,
                        state: "cancelled" as const
                    } : p)),
                }
                : b,
        );
        return {api: repair(raw.api), bubbles};
    } catch {
        return {api: [], bubbles: []};
    }
}

export function save(userId: string, api: ApiMessage[], bubbles: Bubble[]) {
    try {
        sessionStorage.setItem(KEY, JSON.stringify({userId, api, bubbles}));
    } catch {
        // Too big for the tab: the conversation still lives until the next reload.
    }
}

/** A conversation the API will accept: a tool call left without a result (stop, reload) gets a "cancelled" one. */
export function repair(api: ApiMessage[]): ApiMessage[] {
    const last = api[api.length - 1];
    if (last?.role !== "assistant" || typeof last.content === "string") {
        return api;
    }
    const calls = last.content.filter((b) => b.type === "tool_use");
    if (!calls.length) {
        return api;
    }
    return [
        ...api,
        {
            role: "user",
            content: calls.map((b) => ({
                type: "tool_result",
                tool_use_id: b.id,
                is_error: true,
                content: "Annulé : la personne a arrêté la réponse."
            })),
        },
    ];
}

/** Adds a message from the person, joined to the previous one if it got no answer. */
export function addQuestion(api: ApiMessage[], text: string): ApiMessage[] {
    const last = api[api.length - 1];
    if (last?.role !== "user") {
        return [...api, {role: "user", content: text}];
    }
    const content = typeof last.content === "string"
        ? [{type: "text", text: last.content}, {type: "text", text}]
        : [...last.content, {type: "text", text}];
    return [...api.slice(0, -1), {role: "user", content}];
}
