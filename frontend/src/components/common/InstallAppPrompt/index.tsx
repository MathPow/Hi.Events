import {useEffect, useState, useSyncExternalStore} from "react";
import {Button, Drawer} from "@mantine/core";
import {useMediaQuery} from "@mantine/hooks";
import {IconCirclePlus, IconShare2, IconSquarePlus} from "@tabler/icons-react";
import {t, Trans} from "@lingui/macro";
import {
    clearInstallPrompt,
    detectInstallPlatform,
    getInstallPrompt,
    InstallPlatform,
    subscribeToInstallPrompt
} from "../../../utilites/installPrompt.ts";
import classes from './InstallAppPrompt.module.scss';

const SNOOZED_AT_KEY = 'dehors-install-prompt-snoozed-at';
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 3000;

const isSnoozed = () => {
    try {
        return Date.now() - Number(localStorage.getItem(SNOOZED_AT_KEY)) < SNOOZE_MS;
    } catch {
        return false;
    }
};

const snooze = () => {
    try {
        localStorage.setItem(SNOOZED_AT_KEY, String(Date.now()));
    } catch {
        // localStorage unavailable
    }
};

// iOS has no install event: the Share menu's steps, also shown by InstallAppButton.
export const IosInstallSteps = () => (
    <ol className={classes.steps}>
        <li>
            <span className={classes.stepIcon}><IconShare2 size={20}/></span>
            <span>
                <Trans>Tap <strong>Share</strong>. In Safari on recent iPhones, it is under the <strong>•••</strong> button.</Trans>
            </span>
        </li>
        <li>
            <span className={classes.stepIcon}><IconSquarePlus size={20}/></span>
            <span><Trans>Choose <strong>Add to Home Screen</strong>.</Trans></span>
        </li>
        <li>
            <span className={classes.stepIcon}><IconCirclePlus size={20}/></span>
            <span><Trans>Tap <strong>Add</strong>.</Trans></span>
        </li>
    </ol>
);

export const InstallAppPrompt = () => {
    const isPhone = useMediaQuery('(max-width: 767px)');
    const installPrompt = useSyncExternalStore(subscribeToInstallPrompt, getInstallPrompt, () => null);
    const [platform, setPlatform] = useState<InstallPlatform | null>(null);
    const [opened, setOpened] = useState(false);

    useEffect(() => {
        navigator.serviceWorker?.register('/sw.js', {scope: '/manage/'}).catch(() => undefined);
        setPlatform(isSnoozed() ? null : detectInstallPlatform());
    }, []);

    // Android needs Chrome's install event; iOS has none, so it gets the Share-menu steps instead.
    const canOffer = isPhone && (platform === 'ios' || (platform === 'android' && installPrompt !== null));

    useEffect(() => {
        if (!canOffer) {
            return;
        }

        const timer = window.setTimeout(() => setOpened(true), SHOW_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [canOffer]);

    const finish = () => {
        setOpened(false);
        setPlatform(null);
    };

    const dismiss = () => {
        snooze();
        finish();
    };

    const install = async () => {
        if (!installPrompt) {
            return;
        }

        await installPrompt.prompt();
        const {outcome} = await installPrompt.userChoice;
        clearInstallPrompt();
        if (outcome === 'dismissed') {
            snooze();
        }
        finish();
    };

    return (
        <Drawer
            opened={opened}
            onClose={dismiss}
            position="bottom"
            withCloseButton={false}
            trapFocus={false}
            classNames={{content: classes.sheet, body: classes.body}}
            overlayProps={{backgroundOpacity: 0.45, blur: 2}}
        >
            <div className={classes.header}>
                <img src="/manifest-icons/apple-touch-icon.png" alt="" className={classes.appIcon}/>
                <div>
                    <h2 className={classes.title}>{t`Add DEHORS to your home screen`}</h2>
                    <p className={classes.subtitle}>
                        {t`Your sales and check-in in one tap, full screen, like an app.`}
                    </p>
                </div>
            </div>

            {platform === 'ios' ? (
                <>
                    <IosInstallSteps/>
                    <Button fullWidth size="md" onClick={dismiss}>{t`Got it`}</Button>
                </>
            ) : (
                <div className={classes.actions}>
                    <Button fullWidth size="md" onClick={install}>{t`Install the app`}</Button>
                    <Button fullWidth size="md" variant="subtle" onClick={dismiss}>{t`Not now`}</Button>
                </div>
            )}
        </Drawer>
    );
};
