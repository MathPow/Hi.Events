import {useEffect, useRef} from "react";

declare global {
    interface Window {
        turnstile?: {
            render: (container: HTMLElement, options: Record<string, unknown>) => string;
            reset: (widgetId: string) => void;
            remove: (widgetId: string) => void;
        };
    }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise: Promise<void> | null = null;

const loadTurnstileScript = (): Promise<void> => {
    if (window.turnstile) {
        return Promise.resolve();
    }

    if (!scriptPromise) {
        scriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = SCRIPT_URL;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => {
                scriptPromise = null;
                reject(new Error('Turnstile failed to load'));
            };
            document.head.appendChild(script);
        });
    }

    return scriptPromise;
};

interface TurnstileProps {
    siteKey: string;
    onToken: (token: string) => void;
    // Changer cette valeur demande un nouveau defi: un jeton ne sert qu'une fois.
    resetKey?: number;
    className?: string;
}

/**
 * Verification anti-robot de Cloudflare. Le script n'est charge que dans le
 * navigateur, au premier affichage.
 */
export const Turnstile = ({siteKey, onToken, resetKey, className}: TurnstileProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onTokenRef = useRef(onToken);
    onTokenRef.current = onToken;

    useEffect(() => {
        let cancelled = false;

        loadTurnstileScript()
            .then(() => {
                if (cancelled || !containerRef.current || !window.turnstile) {
                    return;
                }

                widgetIdRef.current = window.turnstile.render(containerRef.current, {
                    sitekey: siteKey,
                    language: 'auto',
                    callback: (token: string) => onTokenRef.current(token),
                    'expired-callback': () => onTokenRef.current(''),
                    'error-callback': () => onTokenRef.current(''),
                });
            })
            .catch(() => onTokenRef.current(''));

        return () => {
            cancelled = true;

            if (widgetIdRef.current && window.turnstile) {
                window.turnstile.remove(widgetIdRef.current);
            }

            widgetIdRef.current = null;
        };
    }, [siteKey]);

    useEffect(() => {
        if (!resetKey || !widgetIdRef.current || !window.turnstile) {
            return;
        }

        window.turnstile.reset(widgetIdRef.current);
        onTokenRef.current('');
    }, [resetKey]);

    return <div ref={containerRef} className={className}/>;
};
