import {Menu, UnstyledButton} from "@mantine/core";
import {Link} from "react-router";
import {t} from "@lingui/macro";
import {ReactNode} from "react";
import classes from "./PublicPageBar.module.scss";
import {PublicIcon} from "../PublicIcon";
import {localeToNameMap, SupportedLocales} from "../../../locales.ts";
import {useLingui} from "@lingui/react";
import {getLocaleLabel, switchLocale} from "../LanguageSwitcher";

// Le bouton creme de la barre (48px, coins de 16px), lien ou bouton.
export const PublicBarLink = ({to, children}: { to: string, children: ReactNode }) => (
    <Link to={to} className={classes.button}>{children}</Link>
);

const LanguageMenu = () => {
    // La langue active de Lingui, la meme au serveur et au client (le cookie n'existe que dans le navigateur).
    const {i18n} = useLingui();
    const current = i18n.locale as SupportedLocales;

    return (
        <Menu position="bottom-end" shadow="md" withinPortal>
            <Menu.Target>
                <UnstyledButton className={classes.button} aria-label={t`Language`}>
                    {current.split('-')[0].toUpperCase()}
                </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown className={classes.menu}>
                {(Object.keys(localeToNameMap) as SupportedLocales[]).map((locale) => (
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
// billetterie), a droite « Mes billets » et la langue.
export const PublicPageBar = ({left}: { left: ReactNode }) => (
    <nav className={classes.bar}>
        <div className={classes.left}>{left}</div>
        <div className={classes.right}>
            <PublicBarLink to={'/auth/login?billets=1'}>
                <PublicIcon name={'billet'} className={classes.accentIcon}/>
                <span className={classes.myTickets}>{t`My tickets`}</span>
            </PublicBarLink>
            <LanguageMenu/>
        </div>
    </nav>
);
