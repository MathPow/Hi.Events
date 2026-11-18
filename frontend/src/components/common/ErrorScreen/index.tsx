import {t} from '@lingui/macro';
import {Button} from '@mantine/core';
import type {ReactNode} from 'react';
import {Helmet} from 'react-helmet-async';
import {Link} from 'react-router';
import {PoweredByFooter} from '../PoweredByFooter';
import {useDehorsAppTheme} from '../../../hooks/useDehorsAppTheme';
import classes from './ErrorScreen.module.scss';

interface ErrorAction {
    label: string;
    /** A page of the app. */
    to?: string;
    /** Somewhere else. */
    href?: string;
    onClick?: () => void;
    icon?: ReactNode;
}

interface ErrorScreenProps {
    /** The little handwritten line above, in Felt Tip. */
    kicker: string;
    title: string;
    description: string;
    pageTitle?: string;
    /** Shows the big « 4 [ticket] 4 ». */
    notFound?: boolean;
    /** The address the visitor followed: a link cut while copying is the usual culprit. */
    path?: string | null;
    primary: ErrorAction;
    secondary?: ErrorAction;
    /** Ticket buyers have no account: point them to their tickets rather than a login. */
    showTicketsHint?: boolean;
}

const ActionButton = ({action, variant}: { action: ErrorAction, variant: 'filled' | 'default' }) => {
    const common = {variant, size: 'md', leftSection: action.icon, className: classes.action} as const;
    if (action.to) {
        return <Button {...common} component={Link} to={action.to}>{action.label}</Button>;
    }
    if (action.href) {
        return <Button {...common} component="a" href={action.href}>{action.label}</Button>;
    }
    return <Button {...common} onClick={action.onClick}>{action.label}</Button>;
};

/**
 * The page for a wrong address or a failed load: a cream card on the orange rock, like the
 * sign-in page, with the mountain ticket as the « 0 » of 404 and stickers from the site.
 */
export const ErrorScreen = ({
                                kicker,
                                title,
                                description,
                                pageTitle,
                                notFound = false,
                                path,
                                primary,
                                secondary,
                                showTicketsHint = false,
                            }: ErrorScreenProps) => {
    useDehorsAppTheme();

    return (
        <>
            <Helmet title={pageTitle || title}>
                <meta name="description" content={description}/>
                <meta name="robots" content="noindex"/>
            </Helmet>

            <div className={classes.page}>
                <div className={classes.card} data-rough>
                    <img src="/landing/stickers/autocollant-toilette.svg" alt="" aria-hidden
                         className={`${classes.sticker} ${classes.stickerTree}`}/>
                    <img src="/landing/stickers/autocollant-tente.svg" alt="" aria-hidden
                         className={`${classes.sticker} ${classes.stickerFire}`}/>
                    <img src="/landing/stickers/autocollant-compass.svg" alt="" aria-hidden
                         className={`${classes.sticker} ${classes.stickerBag}`}/>

                    <header className={classes.top}>
                        <Link to="/" className={classes.wordmark} aria-label="Billetterie Dehors">
                            <img src="/logos/billetterie-dehors-wordmark.svg" alt=""/>
                        </Link>
                    </header>

                    <main className={classes.main}>
                        <p className={classes.kicker}>{kicker}</p>

                        {notFound ? (
                            <div className={classes.code} aria-hidden>
                                <span>4</span>
                                <img src="/logos/billetterie-dehors-logomark.svg" alt="" className={classes.ticket}/>
                                <span>4</span>
                            </div>
                        ) : (
                            <img src="/logos/billetterie-dehors-logomark.svg" alt="" aria-hidden
                                 className={classes.ticketAlone}/>
                        )}

                        <h1 className={classes.title}>{title}</h1>
                        <p className={classes.description}>{description}</p>

                        {path && (
                            <p className={classes.path} data-rough>
                                <span className={classes.pathLabel}>{t`Requested address`}</span>
                                <code>{path}</code>
                            </p>
                        )}

                        <div className={classes.actions}>
                            <ActionButton action={primary} variant="filled"/>
                            {secondary && <ActionButton action={secondary} variant="default"/>}
                        </div>

                        {showTicketsHint && (
                            <Link to="/my-tickets" className={classes.tickets} data-rough>
                                <span className={classes.ticketsText}>
                                    <strong>{t`Looking for your tickets?`}</strong>
                                    <span>{t`No account needed: just the email you used at checkout.`}</span>
                                </span>
                                <img src="/interface/fleche-suite.svg" alt="" className={classes.ticketsArrow}/>
                            </Link>
                        )}
                    </main>

                    <PoweredByFooter className={classes.footer}/>
                </div>
            </div>
        </>
    );
};

export default ErrorScreen;
