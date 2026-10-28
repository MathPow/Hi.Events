import {t} from "@lingui/macro";
import classes from "./PublicPageFooter.module.scss";
import {PoweredByFooter} from "../PoweredByFooter";
import {getConfig} from "../../../utilites/config.ts";

// Le pied des pages publiques: les liens legaux a gauche, la mention en pastille a droite.
export const PublicPageFooter = () => (
    <footer className={classes.footer} data-rough>
        <p className={classes.links}>
            <a href={getConfig("VITE_PRIVACY_URL", 'https://hi.events/privacy-policy') as string} target="_blank" rel="noreferrer">
                {t`Privacy Policy`}
            </a>
            <span aria-hidden>·</span>
            <a href={getConfig("VITE_TOS_URL", 'https://hi.events/terms-of-service') as string} target="_blank" rel="noreferrer">
                {t`Terms of Service`}
            </a>
        </p>
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
