import {useEffect} from "react";

// A form's draft in the tab's sessionStorage: a reload in the middle of the form gives it back,
// closing the tab forgets it. Never anything payment-related: the card is typed in Stripe's own
// frame. Storage can be missing or full (private window, SSR): the form then simply starts empty.

const storage = (): Storage | null => {
    try {
        return typeof window === 'undefined' ? null : window.sessionStorage;
    } catch {
        return null;
    }
};

export const readFormDraft = <T, >(key: string | null): T | null => {
    if (!key) {
        return null;
    }
    try {
        const raw = storage()?.getItem(key);
        return raw ? JSON.parse(raw) as T : null;
    } catch {
        return null;
    }
};

export const clearFormDraft = (key: string | null) => {
    if (!key) {
        return;
    }
    try {
        storage()?.removeItem(key);
    } catch {
        // Nothing to forget.
    }
};

/** Writes `values` under `key` shortly after each change, while `enabled`. */
export const useSaveFormDraft = (key: string | null, values: unknown, enabled: boolean) => {
    const serialized = enabled && key ? JSON.stringify(values) : null;

    useEffect(() => {
        if (!key || serialized === null) {
            return;
        }
        const timer = setTimeout(() => {
            try {
                storage()?.setItem(key, serialized);
            } catch {
                // Full or blocked: the draft is only a convenience.
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [key, serialized]);
};
