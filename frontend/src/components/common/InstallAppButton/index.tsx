import {useEffect, useState, useSyncExternalStore} from "react";
import {Button, Drawer} from "@mantine/core";
import {t} from "@lingui/macro";
import {
    clearInstallPrompt,
    detectInstallPlatform,
    getInstallPrompt,
    InstallPlatform,
    subscribeToInstallPrompt
} from "../../../utilites/installPrompt.ts";
import {IosInstallSteps} from "../InstallAppPrompt";
import {PublicBarButton} from "../PublicPageBar";
import {PublicIcon} from "../PublicIcon";
import classes from "../InstallAppPrompt/InstallAppPrompt.module.scss";

/**
 * « Installer l'app » dans la barre d'une page publique qui a son manifeste: le dialogue
 * d'installation du navigateur, ou sur iPhone les etapes du menu Partager. Rien une fois l'app
 * installee, ni dans un navigateur qui ne sait pas l'ajouter (Instagram, Firefox...).
 */
export const InstallAppButton = ({scope, subtitle}: { scope: string, subtitle: string }) => {
    const installPrompt = useSyncExternalStore(subscribeToInstallPrompt, getInstallPrompt, () => null);
    const [platform, setPlatform] = useState<InstallPlatform | null>(null);
    const [stepsOpen, setStepsOpen] = useState(false);

    useEffect(() => {
        navigator.serviceWorker?.register('/sw.js', {scope}).catch(() => undefined);
        setPlatform(detectInstallPlatform());
    }, [scope]);

    if (platform === null || (platform === 'android' && !installPrompt)) {
        return null;
    }

    const install = async () => {
        if (platform === 'ios' || !installPrompt) {
            setStepsOpen(true);
            return;
        }
        await installPrompt.prompt();
        await installPrompt.userChoice;
        clearInstallPrompt();
    };

    return (
        <>
            <PublicBarButton onClick={install}>
                <PublicIcon name={'telecharger'}/>
                <span>{t`Install the app`}</span>
            </PublicBarButton>
            <Drawer
                opened={stepsOpen}
                onClose={() => setStepsOpen(false)}
                position="bottom"
                withCloseButton={false}
                classNames={{content: classes.sheet, body: classes.body}}
                overlayProps={{backgroundOpacity: 0.45, blur: 2}}
            >
                <div className={classes.header}>
                    <img src="/manifest-icons/apple-touch-icon.png" alt="" className={classes.appIcon}/>
                    <div>
                        <h2 className={classes.title}>{t`Add DEHORS to your home screen`}</h2>
                        <p className={classes.subtitle}>{subtitle}</p>
                    </div>
                </div>
                <IosInstallSteps/>
                <Button fullWidth size="md" onClick={() => setStepsOpen(false)}>{t`Got it`}</Button>
            </Drawer>
        </>
    );
};
