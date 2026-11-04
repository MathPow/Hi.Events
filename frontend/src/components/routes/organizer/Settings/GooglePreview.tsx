import {t} from "@lingui/macro";
import classes from "./Settings.module.scss";

// « https://billets.dehorsqc.com › sulpace › course », as Google writes it.
const googleUrl = (url: string) => {
    try {
        const {origin, pathname} = new URL(url);
        return [origin, ...pathname.split('/').filter(Boolean)].join(' › ');
    } catch {
        return url;
    }
};

interface GooglePreviewProps {
    url: string;
    title: string;
    description: string;
    // « 7 nov. 2026 », before the description, for an event.
    date?: string;
}

/**
 * Figma « Aperçu Google (fidèle) »: Google's own white result, wherever a page's Google text is
 * written (the event's settings and the organizer's).
 */
export const GooglePreview = ({url, title, description, date}: GooglePreviewProps) => (
    <div className={classes.googlePreview} aria-label={t`Preview in Google`}>
        <span className={classes.googleHeading}>{t`Preview in Google`}</span>
        <div className={classes.googleSite}>
            <span className={classes.googleFavicon} aria-hidden><span>D</span></span>
            <span className={classes.googleSiteText}>
                {/* eslint-disable-next-line lingui/no-unlocalized-strings */}
                <span className={classes.googleName}>Dehors Billets</span>
                <span className={classes.googleUrl}>{googleUrl(url)}</span>
            </span>
        </div>
        <span className={classes.googleTitle}>{title}</span>
        <span className={classes.googleText}>{date && description ? `${date} — ${description}` : (date ?? description)}</span>
    </div>
);
