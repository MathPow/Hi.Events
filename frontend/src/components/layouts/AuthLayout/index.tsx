import {Link, Navigate, Outlet} from "react-router";
import classes from "./Auth.module.scss";
import {t} from "@lingui/macro";
import {useGetMe} from "../../../queries/useGetMe.ts";
import {PoweredByFooter} from "../../common/PoweredByFooter";
import {LanguageSwitcher} from "../../common/LanguageSwitcher";
import {MouseEvent, useCallback, useRef} from "react";
import {IconChartBar, IconCreditCard, IconPalette, IconQrcode, IconSparkles} from "@tabler/icons-react";
import {isHiEvents} from "../../../utilites/helpers.ts";
import {showInfo} from "../../../utilites/notifications.tsx";
import {useDehorsAppTheme} from "../../../hooks/useDehorsAppTheme.ts";
import {usePhotoPan} from "./usePhotoPan.ts";
import {useRoughEdges} from "../../../hooks/useRoughEdges.ts";

// Ce que la billetterie fait pour l'organisateur, sur la photo (grand ecran seulement).
const features = () => [
    {icon: IconChartBar, title: t`Real-Time Analytics`, description: t`Track sales, revenue, and attendance with detailed reports`},
    {icon: IconCreditCard, title: t`Instant Payouts`, description: t`Get paid immediately via Stripe Connect`},
    {icon: IconQrcode, title: t`QR Code Check-in`, description: t`Mobile scanner with offline support and real-time tracking`},
    {icon: IconPalette, title: t`Custom Branding`, description: t`Your logo, colors, and style on every page`},
];

const Photo = () => {
    const photo = useRef<HTMLDivElement>(null);
    usePhotoPan(photo);

    return (
        <div className={classes.photo} data-rough>
            <div ref={photo} className={classes.photoImage}/>
            <div className={classes.photoShade}/>
            <div className={classes.photoInfo}>
                <span className={classes.photoBadge} data-rough>
                    <IconSparkles size={16}/>
                    {t`Event Management Platform`}
                </span>
                <ul className={classes.features}>
                    {features().map(({icon: Icon, title, description}) => (
                        <li key={title} className={classes.feature}>
                            <span className={classes.featureIcon} data-rough><Icon size={20}/></span>
                            <span>
                                <strong>{title}</strong>
                                <span>{description}</span>
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

const AuthLayout = () => {
    useDehorsAppTheme();
    const roughEdges = useRoughEdges<HTMLDivElement>();
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
        <div ref={roughEdges} className={classes.authLayout}>
            <div className={classes.card} data-rough>
                <div className={classes.formColumn}>
                    <div className={classes.top}>
                        <Link to={'/'} className={classes.backHome} data-rough>
                            <img src={'/interface/fleche-retour.svg'} alt={''} className={classes.arrowLong}/>
                            <img src={'/interface/fleche-retour-petite.svg'} alt={''} className={classes.arrowShort}/>
                            <span className={classes.backLong}>{t`Back to home`}</span>
                            <span className={classes.backShort}>{t`Home`}</span>
                        </Link>
                        <Link to={'/'} className={classes.wordmark} data-rough aria-label={'Billetterie Dehors'}>
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
                            dehorsList
                            comboboxProps={{position: 'top-start'}}
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
