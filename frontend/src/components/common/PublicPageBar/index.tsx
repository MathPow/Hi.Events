import {Menu, UnstyledButton} from "@mantine/core";
import {Link} from "react-router";
import {t} from "@lingui/macro";
import {ReactNode} from "react";
import classes from "./PublicPageBar.module.scss";
import {PublicIcon} from "../PublicIcon";
import {availableLocales, SupportedLocales} from "../../../locales.ts";
import {useLingui} from "@lingui/react";
import {getLocaleLabel, switchLocale} from "../LanguageSwitcher";

// Le bouton creme de la barre (48px, coins de 16px), lien ou bouton.
export const PublicBarLink = ({to, children}: { to: string, children: ReactNode }) => (
    <Link to={to} className={classes.button} data-rough="button">{children}</Link>
);

export const PublicBarButton = ({onClick, children}: { onClick: () => void, children: ReactNode }) => (
    <UnstyledButton className={classes.button} data-rough="button" onClick={onClick}>{children}</UnstyledButton>
);

const LanguageMenu = () => {
    // La langue active de Lingui, la meme au serveur et au client (le cookie n'existe que dans le navigateur).
    const {i18n} = useLingui();
    const current = i18n.locale as SupportedLocales;

    return (
        <Menu position="bottom-end" shadow="md" withinPortal>
            <Menu.Target>
                <UnstyledButton className={classes.button} data-rough="button" aria-label={t`Language`}>
                    {current.split('-')[0].toUpperCase()}
                </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown className={classes.menu}>
                {(availableLocales as SupportedLocales[]).map((locale) => (
                    <Menu.Item
                        key={locale}
                        onClick={() => locale !== current && switchLocale(locale)}
                        data-current={locale === current || undefined}
                    >
                        {getLocaleLabel(locale)}
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
    );
};

// La barre du haut des pages publiques: a gauche ce que la page y met (retour, nom de la
// billetterie), a droite « Mes billets », ou l'action de la page (action), et la langue.
export const PublicPageBar = ({left, action}: { left: ReactNode, action?: ReactNode }) => (
    <nav className={classes.bar}>
        <div className={classes.left}>{left}</div>
        <div className={classes.right}>
            {action ?? (
                <PublicBarLink to={'/my-tickets'}>
                    <PublicIcon name={'billet'} className={classes.accentIcon}/>
                    <span>{t`My tickets`}</span>
                </PublicBarLink>
            )}
            <LanguageMenu/>
        </div>
    </nav>
);
