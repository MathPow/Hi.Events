import {Link, Navigate, Outlet} from "react-router";
import classes from "./Auth.module.scss";
import {t} from "@lingui/macro";
import {useGetMe} from "../../../queries/useGetMe.ts";
import {PoweredByFooter} from "../../common/PoweredByFooter";
import {LanguageSwitcher} from "../../common/LanguageSwitcher";
import {MouseEvent, useCallback, useRef} from "react";
import {isHiEvents} from "../../../utilites/helpers.ts";
import {showInfo} from "../../../utilites/notifications.tsx";
import {useDehorsAppTheme} from "../../../hooks/useDehorsAppTheme.ts";
import {usePhotoPan} from "./usePhotoPan.ts";

const Photo = () => {
    const photo = useRef<HTMLDivElement>(null);
    usePhotoPan(photo);

    return (
        <div className={classes.photo}>
            <div ref={photo} className={classes.photoImage}/>
        </div>
    );
};

const AuthLayout = () => {
    useDehorsAppTheme();
    const me = useGetMe();
    const clickCountRef = useRef(0);
    const clickTimerRef = useRef<ReturnType<typeof setTimeout>>();

    // Five clicks on the "Powered by" line, outside its links, show the version.
    const handleVersionClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
        if ((event.target as HTMLElement).closest('a')) {
            return;
        }
        clickCountRef.current += 1;
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = setTimeout(() => { clickCountRef.current = 0; }, 2000);

        if (clickCountRef.current >= 5) {
            clickCountRef.current = 0;
            showInfo(`HiEvents v${__APP_VERSION__}`);
        }
    }, []);

    if (me.isSuccess) {
        return <Navigate to={'/manage/events'} />
    }

    // Une grande carte creme sur l'orange: le formulaire a gauche, la photo a
    // droite. Sur mobile, la photo passe en haut et porte le retour et le logo.
    return (
        <div className={classes.authLayout}>
            <div className={classes.card}>
                <div className={classes.formColumn}>
                    <div className={classes.top}>
                        <Link to={'/'} className={classes.backHome}>
                            <img src={'/interface/fleche-retour.svg'} alt={''} className={classes.arrowLong}/>
                            <img src={'/interface/fleche-retour-petite.svg'} alt={''} className={classes.arrowShort}/>
                            <span className={classes.backLong}>{t`Back to home`}</span>
                            <span className={classes.backShort}>{t`Home`}</span>
                        </Link>
                        <Link to={'/'} className={classes.wordmark} aria-label={'Billetterie Dehors'}>
                            <span>BILLETTERIE</span>
                            <span>DEHORS</span>
                        </Link>
                    </div>

                    <main className={classes.form}>
                        <Outlet/>
                    </main>

                    <div className={classes.bottom}>
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
                        {!isHiEvents() && (
                            <div onClick={handleVersionClick}>
                                <PoweredByFooter className={classes.poweredBy}/>
                            </div>
                        )}
                        <LanguageSwitcher
                            leftSection={null}
                            rightSection={<img src={'/interface/chevron-bas.svg'} alt={''}/>}
                            classNames={{
                                root: classes.language,
                                input: classes.languageInput,
                                section: classes.languageSection,
                            }}
                        />
                    </div>
                </div>

                <Photo/>
            </div>
        </div>
    );
};

export default AuthLayout;
