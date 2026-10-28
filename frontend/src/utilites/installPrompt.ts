export interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const subscribers = new Set<() => void>();

const notify = () => subscribers.forEach((subscriber) => subscriber());

// Chrome fires beforeinstallprompt once, sometimes before the back office has rendered, so it is
// caught at startup and kept until InstallAppPrompt offers it.
export const captureInstallPrompt = () => {
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredPrompt = event as BeforeInstallPromptEvent;
        notify();
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        notify();
    });
};

export const getInstallPrompt = () => deferredPrompt;

export type InstallPlatform = 'ios' | 'android';

// null once installed, or in browsers that can't add to the home screen (Instagram, Facebook...).
// 'android' stands for every browser with Chrome's install event, desktop included.
export const detectInstallPlatform = (): InstallPlatform | null => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const userAgent = navigator.userAgent;
    const isInAppBrowser = /FBAN|FBAV|Instagram|Messenger|Line\/|TikTok|; wv\)/.test(userAgent);

    if (isStandalone || isInAppBrowser) {
        return null;
    }

    return /iPhone|iPad|iPod/.test(userAgent) ? 'ios' : 'android';
};

export const clearInstallPrompt = () => {
    deferredPrompt = null;
    notify();
};

export const subscribeToInstallPrompt = (subscriber: () => void) => {
    subscribers.add(subscriber);
    return () => {
        subscribers.delete(subscriber);
    };
};
