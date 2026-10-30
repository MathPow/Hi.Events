import {t} from "@lingui/macro";
import {useLingui} from "@lingui/react";
import classes from "./PublicPageFooter.module.scss";
import {PoweredByFooter} from "../PoweredByFooter";
import {getConfig} from "../../../utilites/config.ts";
import {availableLocales} from "../../../locales.ts";
import {switchLocale} from "../LanguageSwitcher";

// Telephone seulement: la langue passe de la barre du haut au pied de page, FR et EN cote a
// cote, la langue active pleine.
const LanguageToggle = () => {
    const {i18n} = useLingui();

    return (
        <div className={classes.languages} role="group" aria-label={t`Language`}>
            {availableLocales.map((locale) => (
                <button key={locale} type="button" lang={locale} className={classes.language}
                        aria-pressed={locale === i18n.locale}
                        onClick={() => locale !== i18n.locale && switchLocale(locale)}>
                    {locale.toUpperCase()}
                </button>
            ))}
        </div>
    );
};

// Le pied des pages publiques, pose sur le fond sans carte: les liens legaux a gauche, la
// mention en pastille a droite. Sur telephone (maquette « Public · Organisateur | Mobile »):
// les liens en court l'un sous l'autre, la langue a droite, la mention centree dessous.
export const PublicPageFooter = () => (
    <footer className={classes.footer}>
        <div className={classes.top}>
            <p className={classes.links}>
                <a href={getConfig("VITE_PRIVACY_URL", 'https://hi.events/privacy-policy') as string} target="_blank" rel="noreferrer">
                    <span className={classes.long}>{t`Privacy Policy`}</span>
                    <span className={classes.short}>{t`Privacy`}</span>
                </a>
                <span className={classes.dot} aria-hidden>·</span>
                <a href={getConfig("VITE_TOS_URL", 'https://hi.events/terms-of-service') as string} target="_blank" rel="noreferrer">
                    <span className={classes.long}>{t`Terms of Service`}</span>
                    <span className={classes.short}>{t`Terms`}</span>
                </a>
            </p>
            <LanguageToggle/>
        </div>
        {/*
         * (c) Hi.Events Ltd 2025
         *
         * PLEASE NOTE:
         *
         * Hi.Events is licensed under the GNU Affero General Public License (AGPL) version 3.
         *
         * You can find the full license text at: https://github.com/HiEventsDev/hi.events/blob/main/LICENCE
         *
         * In accordance with Section 7(b) of the AGPL, we ask that you retain the "Powered by Hi.Events" notice.
         *
         * If you wish to remove this notice, a commercial license is available at: https://hi.events/licensing
         */}
        <PoweredByFooter className={classes.poweredBy}/>
    </footer>
);
