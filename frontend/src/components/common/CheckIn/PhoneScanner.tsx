import {ReactNode, useEffect, useRef, useState} from "react";
import {t} from "@lingui/macro";
import QrScanner from "qr-scanner";
import classes from "./Scanner.module.scss";

const ICONS = '/interface/admin/scanner';

// A code kept in front of the camera counts once, until it has been gone this long.
const SAME_CODE_MS = 4000;

export interface ScanResult {
    tone: 'ok' | 'problem' | 'info';
    title: ReactNode;
    detail?: ReactNode;
}

interface PhoneScannerProps {
    listName?: string;
    eventTitle?: string;
    description?: string | null;
    checkedIn: number;
    total: number;
    result: ScanResult | null;
    query: string;
    onQueryChange: (query: string) => void;
    // The matching attendees, while searching.
    searchResults: ReactNode;
    onSell?: () => void;
    onScan: (code: string) => void;
    onClose: () => void;
}

/**
 * Figma « Scanner (lien bénévole) » (552:3772): the list and its count on top, the camera with its
 * orange frame, then the result in a sheet with the manual search and on-site sales. Searching takes
 * the camera's place, and stops it.
 */
export const PhoneScanner = ({
    listName,
    eventTitle,
    description,
    checkedIn,
    total,
    result,
    query,
    onQueryChange,
    searchResults,
    onSell,
    onScan,
    onClose,
}: PhoneScannerProps) => {
    const video = useRef<HTMLVideoElement>(null);
    const onScanRef = useRef(onScan);
    onScanRef.current = onScan;
    const lastCode = useRef<{ code: string, at: number } | null>(null);
    const [cameraFailed, setCameraFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const searching = query.trim().length > 0;
    const percentage = total > 0 ? Math.min(100, Math.round(checkedIn / total * 100)) : 0;

    useEffect(() => {
        const element = video.current;
        if (searching || !element) {
            return;
        }
        let scanner: QrScanner | null = null;
        // A tick later: a scanner stopped on this same video cuts its stream 300 ms afterwards, so a
        // mount undone right away (React's strict mode) must not leave one behind.
        const timer = window.setTimeout(() => {
            scanner = new QrScanner(element, ({data}) => {
                const now = Date.now();
                const last = lastCode.current;
                lastCode.current = {code: data, at: now};
                if (!last || last.code !== data || now - last.at > SAME_CODE_MS) {
                    onScanRef.current(data);
                }
            }, {returnDetailedScanResult: true, maxScansPerSecond: 4, preferredCamera: 'environment'});

            setCameraFailed(false);
            scanner.start().catch(() => setCameraFailed(true));
        });

        return () => {
            window.clearTimeout(timer);
            scanner?.stop();
            scanner?.destroy();
        };
    }, [searching, attempt]);

    return (
        <div className={classes.scanner}>
            <div className={classes.top}>
                <div className={classes.topRow}>
                    <div className={classes.topText}>
                        <h1 className={classes.topTitle}>{listName}</h1>
                        {eventTitle && <p className={classes.topEvent}>{eventTitle}</p>}
                        {description && <p className={classes.topDescription}>{description}</p>}
                    </div>
                    <button type="button" className={classes.topClose} onClick={onClose} aria-label={t`Close the scanner`}>
                        <img src={`${ICONS}/fermer.svg`} width={18} height={18} alt=""/>
                    </button>
                </div>
                <div className={classes.progress}>
                    <div className={classes.progressText}>
                        <span>{t`${checkedIn} / ${total} checked in`}</span>
                        <span className={classes.progressPercent}>{percentage} %</span>
                    </div>
                    <span className={classes.progressBar} role="progressbar" aria-valuemin={0} aria-valuemax={100}
                          aria-valuenow={percentage}>
                        <span style={{width: `${percentage}%`}}/>
                    </span>
                </div>
            </div>

            {!searching && (
                <div className={classes.camera}>
                    <video ref={video} className={classes.video} playsInline muted/>
                    {cameraFailed ? (
                        <div className={classes.cameraProblem}>
                            <p>{t`The camera is not available. Allow it in your browser, or search for the attendee by name.`}</p>
                            <button type="button" className={classes.cameraRetry} onClick={() => setAttempt(value => value + 1)}>
                                {t`Try again`}
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className={classes.frame} aria-hidden>
                                <img src={`${ICONS}/coin-hg.svg`} alt=""/>
                                <img src={`${ICONS}/coin-hd.svg`} alt=""/>
                                <img src={`${ICONS}/coin-bg.svg`} alt=""/>
                                <img src={`${ICONS}/coin-bd.svg`} alt=""/>
                            </div>
                            <p className={classes.cameraHint}>{t`Place the ticket's QR code in the frame`}</p>
                        </>
                    )}
                </div>
            )}

            <div className={classes.sheet} data-searching={searching || undefined}>
                {!searching && result && (
                    <div className={classes.result} data-tone={result.tone} role="status">
                        <span className={classes.resultIcon}>
                            <img src={`${ICONS}/${result.tone === 'ok' ? 'crochet' : 'fermer'}.svg`} width={24} height={24} alt=""/>
                        </span>
                        <span className={classes.resultText}>
                            <strong>{result.title}</strong>
                            {result.detail && <span>{result.detail}</span>}
                        </span>
                    </div>
                )}

                <label className={classes.search}>
                    <img src={`${ICONS}/chercher.svg`} width={20} height={20} alt=""/>
                    <input
                        type="search"
                        value={query}
                        placeholder={t`Search for a name or an order number`}
                        aria-label={t`Search for a name or an order number`}
                        onChange={(event) => onQueryChange(event.currentTarget.value)}
                    />
                    {searching && (
                        <button type="button" className={classes.searchClear} onClick={() => onQueryChange('')}
                                aria-label={t`Back to the camera`}>
                            <img src={`${ICONS}/fermer-encre.svg`} width={16} height={16} alt=""/>
                        </button>
                    )}
                </label>

                {searching && <div className={classes.searchResults}>{searchResults}</div>}

                {!searching && onSell && (
                    <button type="button" className={classes.sell} onClick={onSell}>
                        <img src={`${ICONS}/plus.svg`} width={20} height={20} alt=""/>
                        {t`Sell a ticket on site`}
                    </button>
                )}
            </div>
        </div>
    );
};
