import type {CaptureResult, PostHog, Properties} from 'posthog-js';
import {getConfig} from './config';
import {getConsentState} from './trackingPixels/consent';

const TRACKED_PATHS = /^\/(e|event|events|widget|checkout)\//;
const PREVIEW_PATHS = /^\/event\/[^/]+\/preview/;
const RECORDED_PATHS = /^\/(e|event|events|widget)\//;
const ORDER_ID_IN_URL = /(\/checkout\/[^/?#]+\/)[^/?#]+/g;

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;
let listening = false;

const isTrackedPath = (pathname: string) => TRACKED_PATHS.test(pathname) && !PREVIEW_PATHS.test(pathname);

const redactOrderIds = (event: CaptureResult): CaptureResult => {
    const properties = event.properties ?? {};
    for (const key of Object.keys(properties)) {
        if (typeof properties[key] === 'string') {
            properties[key] = properties[key].replace(ORDER_ID_IN_URL, '$1:order');
        }
    }
    return event;
};

const syncSessionRecording = (pathname: string) => {
    if (!client) return;
    const shouldRecord = RECORDED_PATHS.test(pathname) && !PREVIEW_PATHS.test(pathname);

    if (shouldRecord && !client.sessionRecordingStarted()) {
        client.startSessionRecording();
    } else if (!shouldRecord && client.sessionRecordingStarted()) {
        client.stopSessionRecording();
    }
};

const loadPostHog = (key: string): Promise<PostHog | null> => {
    if (loading) return loading;

    loading = import('posthog-js')
        .then(({default: posthog}) => {
            client = posthog;
            posthog.init(key, {
                api_host: getConfig('VITE_POSTHOG_HOST', 'https://eu.i.posthog.com'),
                person_profiles: 'identified_only',
                capture_pageview: 'history_change',
                capture_pageleave: true,
                disable_session_recording: true,
                session_recording: {
                    maskAllInputs: true,
                },
                before_send: (event) => {
                    if (!event) return null;

                    const pathname = window.location.pathname;
                    if (event.event === '$pageview') {
                        syncSessionRecording(pathname);
                    }

                    return isTrackedPath(pathname) ? redactOrderIds(event) : null;
                },
                loaded: () => {
                    syncSessionRecording(window.location.pathname);
                },
            });
            client = posthog;
            return posthog;
        })
        .catch((error) => {
            console.error('[hi.events] Failed to load PostHog:', error);
            loading = null;
            return null;
        });

    return loading;
};

export function initPostHog(): void {
    if (typeof window === 'undefined') return;

    const key = getConfig('VITE_POSTHOG_KEY');
    if (!key) return;

    if (getConsentState() === 'granted') {
        loadPostHog(key);
    }

    if (listening) return;
    listening = true;

    window.addEventListener('hi_consent_change', (e: Event) => {
        const granted = (e as CustomEvent).detail?.granted === true;

        if (granted) {
            client?.opt_in_capturing();
            loadPostHog(key);
        } else if (client) {
            client.stopSessionRecording();
            client.opt_out_capturing();
        }
    });
}

export function capturePostHogEvent(eventName: string, properties?: Properties): void {
    const key = getConfig('VITE_POSTHOG_KEY');
    if (typeof window === 'undefined' || !key || getConsentState() !== 'granted') return;

    loadPostHog(key).then((instance) => instance?.capture(eventName, properties));
}
