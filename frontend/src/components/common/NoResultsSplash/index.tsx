import React from "react";
import classes from './NoResultsSplash.module.scss';
import {useSearchParams} from "react-router";
import {t} from "@lingui/macro";
import {PublicIcon, PublicIconName} from "../PublicIcon";

interface NoResultsSplashProps {
    heading?: React.ReactNode,
    children?: React.ReactNode,
    subHeading?: React.ReactNode,
    // The old blank-slate illustration: now picks the icon of the empty state (see ICONS).
    imageHref?: string,
    icon?: PublicIconName,
}

// The illustrations of the former blank slates, replaced by the icon of what the list holds.
const ICONS: Record<string, PublicIconName> = {
    '/blank-slate/tickets.svg': 'billet',
    '/blank-slate/attendees.svg': 'billet',
    '/blank-slate/orders.svg': 'etiquette',
    '/blank-slate/promo-codes.svg': 'etiquette',
    '/blank-slate/check-in-lists.svg': 'qr',
    '/blank-slate/capacity-assignments.svg': 'billet',
    '/blank-slate/waitlist.svg': 'horloge',
    '/blank-slate/webhooks.svg': 'globe',
    '/blank-slate/messages.svg': 'courriel',
    '/blank-slate/events.svg': 'calendrier',
    '/blank-slate/reports.svg': 'info',
    '/blank-slate/affiliates.png': 'partager',
};

// Empty state of a list: a cream card, an icon, a sentence and the page's action (children).
export const NoResultsSplash = ({
                                    heading = t`'There\'s nothing to show yet'`,
                                    children,
                                    subHeading,
                                    imageHref = '/no-results-empty-boxes.svg',
                                    icon,
                                }: NoResultsSplashProps) => {
    const [searchParams] = useSearchParams();
    const hasSearchQuery = !!searchParams.get('query');
    const iconName: PublicIconName = hasSearchQuery ? 'recherche' : (icon ?? ICONS[imageHref] ?? 'info');

    return (
        <div className={classes.container}>
            <span className={classes.pastille}>
                <PublicIcon name={iconName} size={26}/>
            </span>

            {heading && !hasSearchQuery && <h2>{heading}</h2>}

            {hasSearchQuery && (
                <h2>{t`No search results.`}</h2>
            )}

            {(subHeading && !hasSearchQuery) && <div className={classes.text}>{subHeading}</div>}

            {children && <div className={classes.actions}>{children}</div>}
        </div>
    )
}
