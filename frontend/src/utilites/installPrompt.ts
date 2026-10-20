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
