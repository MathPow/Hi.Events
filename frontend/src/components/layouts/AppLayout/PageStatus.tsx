import {createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState} from "react";

// What a page shows in the top bar besides the breadcrumbs: a detail after its name
// (« Paramètres / Organisation ») and, on pages that save by themselves, whether everything is saved.

export type SaveState = 'saving' | 'saved' | 'error';

interface SaveEntry {
    state: SaveState;
    retry?: () => void;
}

interface PageStatusContextValue {
    setPageDetail: (detail: string | null) => void;
    registerAutosave: () => () => void;
    reportSave: (key: string, entry: SaveEntry) => void;
}

const PageStatusContext = createContext<PageStatusContextValue | null>(null);

export interface PageStatus {
    detail: string | null;
    // Null on pages that don't save by themselves: no indicator then.
    save: { state: SaveState, retry: () => void } | null;
}

export const PageStatusProvider = ({children, render}: {
    children?: ReactNode,
    render: (status: PageStatus) => ReactNode,
}) => {
    const [detail, setDetail] = useState<string | null>(null);
    const [autosavePages, setAutosavePages] = useState(0);
    const [entries, setEntries] = useState<Record<string, SaveEntry>>({});
    const registrations = useRef(0);

    // A section that leaves keeps its state (a failed save can still be retried from the top bar);
    // everything is forgotten when the page leaves.
    const registerAutosave = useCallback(() => {
        registrations.current += 1;
        setAutosavePages(registrations.current);
        return () => {
            registrations.current -= 1;
            setAutosavePages(registrations.current);
            if (registrations.current === 0) {
                setEntries({});
            }
        };
    }, []);

    const reportSave = useCallback((key: string, entry: SaveEntry) => {
        setEntries(current => ({...current, [key]: entry}));
    }, []);

    const value = useMemo(() => ({setPageDetail: setDetail, registerAutosave, reportSave}), [registerAutosave, reportSave]);

    const save = useMemo(() => {
        if (autosavePages <= 0) {
            return null;
        }
        const all = Object.values(entries);
        const failed = all.filter(entry => entry.state === 'error');
        const state: SaveState = all.some(entry => entry.state === 'saving')
            ? 'saving'
            : failed.length > 0 ? 'error' : 'saved';

        return {state, retry: () => failed.forEach(entry => entry.retry?.())};
    }, [autosavePages, entries]);

    return (
        <PageStatusContext.Provider value={value}>
            {render({detail, save})}
            {children}
        </PageStatusContext.Provider>
    );
};

// « Paramètres / Organisation »: the page's own detail after its name in the breadcrumbs.
export const usePageDetail = (detail: string | null) => {
    const context = useContext(PageStatusContext);

    useEffect(() => {
        context?.setPageDetail(detail);
        return () => context?.setPageDetail(null);
    }, [context, detail]);
};

/**
 * For pages that save each field by themselves: shows « Changements enregistrés » in the top bar while
 * mounted. track() reports one save (by key, a section of the page) and the way to try it again.
 */
export const useAutosaveStatus = () => {
    const context = useContext(PageStatusContext);

    useEffect(() => context?.registerAutosave(), [context]);

    return useCallback(<T, >(key: string, run: () => Promise<T>, retry: () => void): Promise<T> => {
        context?.reportSave(key, {state: 'saving'});

        return run().then(
            (result) => {
                context?.reportSave(key, {state: 'saved'});
                return result;
            },
            (error) => {
                context?.reportSave(key, {state: 'error', retry});
                throw error;
            },
        );
    }, [context]);
};

/**
 * Changes of a section saved together: they wait a moment (several fields left in a row make one
 * request), go one request at a time, and what is still waiting leaves when the page closes.
 */
export const useSectionAutosave = <T extends object>(
    key: string,
    save: (changes: Partial<T>) => Promise<unknown>,
    handlers: {
        onSaved?: (changes: Partial<T>) => void,
        onFailed?: (error: unknown, changes: Partial<T>) => void,
    } = {},
) => {
    const track = useAutosaveStatus();
    const saveRef = useRef(save);
    const handlersRef = useRef(handlers);
    const pending = useRef<Partial<T>>({});
    const timer = useRef<number | undefined>(undefined);
    const chain = useRef<Promise<void>>(Promise.resolve());

    saveRef.current = save;
    handlersRef.current = handlers;

    const flush = useCallback((): Promise<void> => {
        window.clearTimeout(timer.current);

        chain.current = chain.current.then(async () => {
            const changes = pending.current;
            if (Object.keys(changes).length === 0) {
                return;
            }
            pending.current = {};

            // Trying again sends these changes, unless newer ones replaced them meanwhile.
            const retry = () => {
                pending.current = {...changes, ...pending.current};
                flush();
            };

            try {
                await track(key, () => saveRef.current(changes), retry);
                handlersRef.current.onSaved?.(changes);
            } catch (error: any) {
                // Refused values stay on their field, with the server's message, until corrected;
                // the others (network, server) leave again with the next save.
                if (error?.response?.status !== 422) {
                    pending.current = {...changes, ...pending.current};
                }
                handlersRef.current.onFailed?.(error, changes);
            }
        });

        return chain.current;
    }, [key, track]);

    const queue = useCallback((changes: Partial<T>) => {
        pending.current = {...pending.current, ...changes};
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(flush, 300);
    }, [flush]);

    useEffect(() => () => {
        flush();
    }, [flush]);

    return queue;
};
