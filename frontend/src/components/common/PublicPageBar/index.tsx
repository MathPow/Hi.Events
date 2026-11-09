import {UnstyledButton} from "@mantine/core";
import {Link, useLocation} from "react-router";
import {t} from "@lingui/macro";
import {ReactNode} from "react";
import classes from "./PublicPageBar.module.scss";
import {PublicIcon} from "../PublicIcon";
import {availableLocales, SupportedLocales} from "../../../locales.ts";
import {useLingui} from "@lingui/react";
import {switchLocale} from "../LanguageSwitcher";

// Le bouton creme de la barre (48px, coins de 16px), lien ou bouton.
export const PublicBarLink = ({to, className, children}: { to: string, className?: string, children: ReactNode }) => (
    <Link to={to} className={className ? `${classes.button} ${className}` : classes.button} data-rough="button">{children}</Link>
);

export const PublicBarButton = ({onClick, children}: { onClick: () => void, children: ReactNode }) => (
    <UnstyledButton className={classes.button} data-rough="button" onClick={onClick}>{children}</UnstyledButton>
);

// Deux langues seulement: un clic passe a l'autre. Le bouton montre la langue vers laquelle il mene.
const LanguageToggle = () => {
    // La langue active de Lingui, la meme au serveur et au client (le cookie n'existe que dans le navigateur).
    const {i18n} = useLingui();
    const current = i18n.locale.split('-')[0];
    const next = ((availableLocales as SupportedLocales[]).find((locale) => locale !== current) ?? 'fr') as SupportedLocales;

    return (
        <UnstyledButton
            className={`${classes.button} ${classes.language}`}
            data-rough="button"
            lang={next}
            aria-label={next === 'fr' ? 'Passer au français' : 'Switch to English'}
            onClick={() => switchLocale(next)}
        >
            {next.toUpperCase()}
        </UnstyledButton>
    );
};

// La barre du haut des pages publiques: a gauche ce que la page y met (retour, nom de la
// billetterie), a droite « Evenements » (sauf sur leur page) et « Mes billets », en icones
// seules sur telephone, ou l'action de la page (action), et la langue.
export const PublicPageBar = ({left, action}: { left: ReactNode, action?: ReactNode }) => {
    const {pathname} = useLocation();
    const onEvents = pathname.replace(/\/$/, '') === '/events';

    return (
        <nav className={classes.bar}>
            <div className={classes.left}>{left}</div>
            <div className={classes.right}>
                {action ?? (
                    <>
                        {!onEvents && (
                            <PublicBarLink to={'/events'} className={classes.iconOnMobile}>
                                <PublicIcon name={'calendrier'} className={classes.accentIcon}/>
                                <span className={classes.label}>{t`Events`}</span>
                            </PublicBarLink>
                        )}
                        <PublicBarLink to={'/my-tickets'} className={classes.iconOnMobile}>
                            <PublicIcon name={'billet'} className={classes.accentIcon}/>
                            <span className={classes.label}>{t`My tickets`}</span>
                        </PublicBarLink>
                    </>
                )}
                <LanguageToggle/>
            </div>
        </nav>
    );
};
