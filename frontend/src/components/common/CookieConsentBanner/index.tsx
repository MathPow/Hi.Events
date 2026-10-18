import {useEffect, useId, useRef, useState} from 'react';
import {t} from '@lingui/macro';
import {IconX} from '@tabler/icons-react';
import {getConfig} from '../../../utilites/config';
import {getConsentState} from '../../../utilites/trackingPixels/consent';
import {useRoughEdge} from '../../../hooks/useRoughEdge';
import classes from './CookieConsentBanner.module.scss';

// Between the page showing (the landing's opening done) and the panel opening, on a first visit.
const OPEN_AFTER = 900;

/** Once chosen, the biscuit stays on the public pages only: elsewhere it would sit on the page's own buttons. */
const biscuitPage = () => typeof window !== 'undefined'
    && (window.location.pathname === '/' || window.location.pathname.startsWith('/events/'));

/** Calls back once the landing's opening (Opening.tsx) is gone, or right away elsewhere. */
const whenPageShows = (callback: () => void) => {
    if (!document.querySelector('[data-landing-opening]')) {
        callback();
        return () => undefined;
    }
    const observer = new MutationObserver(() => {
        if (!document.querySelector('[data-landing-opening]')) {
            observer.disconnect();
            callback();
        }
    });
    observer.observe(document.body, {childList: true, subtree: true});
    return () => observer.disconnect();
};

/**
 * The DEHORS shop's cookie banner (BanniereTemoins.vue): a biscuit at the
 * bottom right, the mountain bitten, which opens a small brown panel. On a
 * first visit the panel opens by itself once the page shows, without taking
 * the focus, and waits for an answer; after that it only comes back from the
 * biscuit, to change one's mind. Accepting and declining weigh the same, as
 * Quebec's Law 25 asks; « Customize » shows the two categories.
 */
export const CookieConsentBanner = ({onConsent}: { onConsent: (granted: boolean) => void }) => {
    const [chosen, setChosen] = useState(() => getConsentState() !== 'pending');
    const [granted, setGranted] = useState(() => getConsentState() === 'granted');
    const [shown, setShown] = useState(false);
    const [open, setOpen] = useState(false);
    const [details, setDetails] = useState(false);
    const [measure, setMeasure] = useState(granted);
    const [onBiscuitPage, setOnBiscuitPage] = useState(biscuitPage);
    const panel = useRef<HTMLElement>(null);
    const biscuit = useRef<HTMLButtonElement>(null);
    const focusOnOpen = useRef(false);
    const roughPanel = useRoughEdge<HTMLDivElement>({amplitude: 1.5, step: 40});
    const titleId = useId();
    const panelId = useId();
    const privacyUrl = getConfig('VITE_PRIVACY_URL');

    useEffect(() => {
        let timer: number | undefined;
        const stop = whenPageShows(() => {
            setShown(true);
            if (!chosen) {
                timer = window.setTimeout(() => setOpen(true), OPEN_AFTER);
            }
        });

        return () => {
            stop();
            window.clearTimeout(timer);
        };
        // Only on arrival: after a choice the panel never opens by itself again.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // The router moves without telling: the page is checked again after each click and history step.
    useEffect(() => {
        const check = () => window.setTimeout(() => setOnBiscuitPage(biscuitPage()));
        document.addEventListener('click', check, true);
        window.addEventListener('popstate', check);

        return () => {
            document.removeEventListener('click', check, true);
            window.removeEventListener('popstate', check);
        };
    }, []);

    useEffect(() => {
        if (open && focusOnOpen.current) {
            focusOnOpen.current = false;
            panel.current?.querySelector<HTMLElement>('button')?.focus();
        }
    }, [open]);

    useEffect(() => {
        if (details) {
            panel.current?.querySelector<HTMLElement>('input:not(:disabled)')?.focus();
        }
    }, [details]);

    const openPanel = () => {
        setMeasure(granted);
        setDetails(false);
        focusOnOpen.current = true;
        setOpen(true);
    };

    /** The focus goes back to the biscuit if it was in the panel, not left on a button that's gone. */
    const close = () => {
        const focusInside = panel.current?.contains(document.activeElement) ?? false;
        setOpen(false);
        if (focusInside) {
            biscuit.current?.focus();
        }
    };

    const choose = (accepted: boolean) => {
        onConsent(accepted);
        setChosen(true);
        setGranted(accepted);
        close();
    };

    if (!shown || (chosen && !open && !onBiscuitPage)) {
        return null;
    }

    return (
        <div className={classes.cookies}>
            <section ref={panel} id={panelId} className={classes.shadow} data-open={open ? '' : undefined}
                     aria-labelledby={titleId} aria-hidden={!open}
                     onKeyDown={(event) => event.key === 'Escape' && chosen && close()}>
                <div ref={roughPanel} className={classes.panel}>
                    <div className={classes.head}>
                        <h2 id={titleId} className={classes.title}>{t`Want a cookie?`}</h2>
                        {/* On a first visit an answer is awaited: no closing without a choice. */}
                        {chosen && (
                            <button type="button" className={classes.close} aria-label={t`Close`} onClick={close}>
                                <IconX size={18} stroke={2.5} aria-hidden="true"/>
                            </button>
                        )}
                    </div>
                    <p className={classes.text}>
                        {t`We use cookies to make the ticketing work, like keeping you logged in and remembering your language. With your OK, we also measure visits, and organizers can measure their ads.`}
                        {privacyUrl && (
                            <>
                                {' '}
                                <a href={privacyUrl} target="_blank" rel="noopener noreferrer">{t`Privacy Policy`}</a>
                            </>
                        )}
                    </p>

                    {details && (
                        <div className={classes.choices}>
                            <div className={classes.row}>
                                <span className={classes.description}>
                                    <span className={classes.name}>{t`Essential`}</span>
                                    {t`Your login, your language, payment and this choice. Always on.`}
                                </span>
                                <input type="checkbox" role="switch" className={classes.switch} checked readOnly disabled
                                       aria-label={t`Essential cookies, always on`}/>
                            </div>
                            <label className={classes.row}>
                                <span className={classes.description}>
                                    <span className={classes.name}>{t`Analytics`}</span>
                                    {t`Visit statistics, and the organizers' tools to measure their ads.`}
                                </span>
                                <input type="checkbox" role="switch" className={classes.switch} checked={measure}
                                       onChange={(event) => setMeasure(event.target.checked)}/>
                            </label>
                        </div>
                    )}

                    <div className={classes.actions}>
                        {details ? (
                            <button type="button" className={`${classes.action} ${classes.accept}`}
                                    onClick={() => choose(measure)}>{t`Save my choices`}</button>
                        ) : (
                            <>
                                <button type="button" className={`${classes.action} ${classes.accept}`}
                                        onClick={() => choose(true)}>{t`Accept`}</button>
                                <button type="button" className={`${classes.action} ${classes.decline}`}
                                        onClick={() => choose(false)}>{t`Decline`}</button>
                                <button type="button" className={`${classes.action} ${classes.customize}`}
                                        onClick={() => setDetails(true)}>{t`Customize`}</button>
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* The biscuit: the mountain bitten, on a round drawn by hand. Its two crumbs stay put. */}
            <button ref={biscuit} type="button" className={classes.biscuit} aria-label={t`Cookies`}
                    aria-controls={panelId} aria-expanded={open} onClick={() => (open ? close() : openPanel())}>
                <span className={classes.round} aria-hidden="true"/>
                <svg className={classes.drawing} width="80" height="94" viewBox="0 0 80 94" aria-hidden="true"
                     focusable="false">
                    <path d="M79.4102 80.79C79.1402 82.24 78.1502 83.35 77.2002 84.49C76.2802 85.59 75.5802 87.35 74.0702 87.64C72.4502 87.96 71.3202 88.91 69.8202 89.39C68.5302 89.8 67.1402 89.49 65.6502 89.88C64.3202 90.23 62.9202 90.64 61.4402 90.95C60.0802 91.24 58.5902 91.12 57.1102 91.36C55.7202 91.58 54.3702 92.41 52.8902 92.57C51.4902 92.73 50.0202 92.69 48.5302 92.78C47.1202 92.87 45.6702 93.18 44.1902 93.21C42.7702 93.23 41.3202 92.71 39.8402 92.66C38.4102 92.62 37.0302 92.14 35.6602 92.06C34.2202 91.98 32.7702 92.62 31.4102 92.5C29.9702 92.37 28.5602 92.24 27.2002 92.08C25.7702 91.91 24.3002 92.13 22.9602 91.93C21.5202 91.71 20.1902 91.08 18.8502 90.83C17.4102 90.57 15.9902 90.42 14.6902 90.14C13.2302 89.82 11.7802 89.77 10.5002 89.44C9.03021 89.07 7.88021 87.9 6.64021 87.53C5.11021 87.08 3.58021 86.54 2.56021 85.44C1.51021 84.32 0.520207 82.86 0.190207 81.35C-0.139793 79.9 -0.039793 78.12 0.460207 76.6C1.17021 74.39 2.06021 74.68 2.77021 72.47C3.48021 70.27 3.37021 70.23 4.08021 68.03C4.79021 65.82 3.94021 65.55 4.65021 63.34C5.36021 61.14 5.63021 61.23 6.35021 59.02C7.06021 56.82 7.59021 56.99 8.30021 54.79C9.01021 52.58 8.80021 52.51 9.51021 50.31C10.2202 48.11 10.5802 48.22 11.3002 46.02C12.0102 43.82 11.9602 43.8 12.6702 41.6C13.3802 39.39 13.2502 39.35 13.9702 37.15C14.6802 34.95 14.2302 34.79 14.7502 32.53C15.2102 30.52 17.4502 28.24 18.6702 28.11C20.4602 27.93 20.3502 29.5 21.5902 30.01C22.7202 30.48 23.0002 31.3 23.5802 32.66C24.4702 34.75 24.9902 34.53 25.8802 36.62C26.7702 38.71 26.9602 38.63 27.8402 40.72C28.7302 42.8 28.9402 43.68 29.4702 44.82C30.6902 42.8 29.8602 42.75 30.6002 40.67C31.3502 38.58 32.2202 38.89 32.9602 36.81C33.7002 34.73 32.5802 34.33 33.3202 32.25C34.0602 30.17 35.2702 30.6 36.0102 28.52C36.7602 26.44 36.7302 26.43 37.4702 24.34C38.2202 22.26 37.6302 22.05 38.3702 19.97C39.1102 17.89 38.7002 17.74 39.4402 15.66C40.1802 13.58 41.0802 13.9 41.8302 11.82C42.5702 9.73997 41.8502 9.48997 42.6002 7.39997C43.3402 5.31997 44.0202 5.56997 44.7702 3.48997C45.2802 2.03997 45.8002 0.779969 46.9602 0.309969C48.2102 -0.190031 49.7602 -0.0700307 51.0002 0.529969C52.1302 1.06997 53.2702 2.06997 53.7702 3.49997C54.2502 4.84997 54.6402 6.31997 55.1702 7.81997C55.6502 9.18997 55.8502 10.73 56.3702 12.21C56.8602 13.6 57.3302 15.04 57.8502 16.5C58.3402 17.9 58.7402 19.37 59.2602 20.82C59.5202 21.57 59.8002 22.32 60.0802 23.07C58.4302 24.73 57.3902 26.89 57.2102 29.33C57.0302 31.83 56.6802 33.79 58.2702 35.76C53.3502 37.33 51.2002 41.61 50.8302 46.31C50.3102 52.82 55.7402 56.91 63.4902 56.94C64.8902 62.38 70.4102 63.91 74.3702 63.89C74.5102 63.89 74.6602 63.89 74.8102 63.88C75.3002 65.23 75.8702 66.5 76.3002 67.75C76.8202 69.26 77.6902 70.57 78.1502 71.92C78.6902 73.48 78.8202 75.04 79.2602 76.34C79.7502 77.79 79.6802 79.37 79.4102 80.79Z"/>
                    <path d="M74.92 24.8701C75.52 25.9901 76.06 27.2201 75.72 28.3401C75.38 29.4601 72.09 31.8601 69.61 31.7301C68.44 31.6701 67.1 30.4901 66.5 29.3701C65.9 28.2501 66.7 26.8301 67.04 25.7101C67.38 24.5901 71.21 22.3901 72.34 22.7401C73.47 23.0901 74.33 23.7501 74.92 24.8701Z"/>
                    <path d="M65.1899 43.2C66.2099 41.75 69.8999 40.04 71.0699 42.36C71.8099 43.83 75.8399 42.75 77.2399 45.92C77.8999 47.42 77.1199 49.42 76.0999 50.87C75.0799 52.32 71.9099 54.1 68.9999 52.74C67.5099 52.05 64.4299 49.38 64.1499 47.76C63.8699 46.14 64.1699 44.64 65.1799 43.2H65.1899Z"/>
                </svg>
            </button>
        </div>
    );
};
