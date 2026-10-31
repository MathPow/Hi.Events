import {useCallback, useEffect, useState} from "react";
import {pushClient} from "../api/organizerMessage.client.ts";

/**
 * Les notifications Web Push de cet appareil, par le service worker du tableau de bord (/manage/).
 *
 * - unsupported: le navigateur ne les connait pas;
 * - ios-install: sur iPhone et iPad, Safari ne les permet qu'a l'app ajoutee a l'ecran d'accueil;
 * - denied: refusees dans le navigateur (a reactiver dans ses reglages);
 * - off / on: pret a les activer, ou deja actives.
 */
export type WebPushState = 'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

const SCOPE = '/manage/';

// L'iPad se presente comme un Mac (MacIntel), mais tactile.
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
    // eslint-disable-next-line lingui/no-unlocalized-strings
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// eslint-disable-next-line lingui/no-unlocalized-strings
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isSupported = () => typeof window !== 'undefined'
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// La cle publique VAPID (base64url) en octets, comme pushManager.subscribe la veut.
const keyToBytes = (base64: string) => {
    const padded = (base64 + '='.repeat((4 - base64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

const registration = async () => {
    await navigator.serviceWorker.register('/sw.js', {scope: SCOPE});
    // Pret = actif: subscribe() echoue sur un service worker encore en installation.
    return navigator.serviceWorker.ready;
};

export const useWebPush = () => {
    const [state, setState] = useState<WebPushState>('loading');
    const [isBusy, setIsBusy] = useState(false);

    const refresh = useCallback(async () => {
        if (!isSupported()) {
            setState(isIos() && !isStandalone() ? 'ios-install' : 'unsupported');
            return;
        }

        if (Notification.permission === 'denied') {
            setState('denied');
            return;
        }

        try {
            const subscription = Notification.permission === 'granted'
                ? await (await registration()).pushManager.getSubscription()
                : null;

            if (subscription) {
                // Rattache l'appareil a l'utilisateur connecte (il a pu changer de compte).
                await pushClient.subscribe(subscription.toJSON());
            }
            setState(subscription ? 'on' : 'off');
        } catch {
            setState('off');
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const enable = async (): Promise<boolean> => {
        setIsBusy(true);
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                setState(permission === 'denied' ? 'denied' : 'off');
                return false;
            }

            const worker = await registration();
            const applicationServerKey = keyToBytes(await pushClient.publicKey());

            let subscription: PushSubscription;
            try {
                subscription = await worker.pushManager.subscribe({userVisibleOnly: true, applicationServerKey});
            } catch {
                // Abonne avec une autre cle du serveur: on repart de zero.
                await (await worker.pushManager.getSubscription())?.unsubscribe();
                subscription = await worker.pushManager.subscribe({userVisibleOnly: true, applicationServerKey});
            }

            await pushClient.subscribe(subscription.toJSON());
            setState('on');
            return true;
        } finally {
            setIsBusy(false);
        }
    };

    const disable = async () => {
        setIsBusy(true);
        try {
            const subscription = await (await registration()).pushManager.getSubscription();
            if (subscription) {
                await pushClient.unsubscribe(subscription.endpoint).catch(() => undefined);
                await subscription.unsubscribe();
            }
            setState('off');
        } finally {
            setIsBusy(false);
        }
    };

    return {state, isBusy, enable, disable};
};
