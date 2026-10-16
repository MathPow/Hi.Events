import {NavLink, Outlet, useLocation} from "react-router";
import {Header} from "../../common/Header";
import {Container} from "@mantine/core";
import {GlobalMenu} from "../../common/GlobalMenu";
import ImpersonationBanner from "../../common/ImpersonationBanner";
import {useDehorsAppTheme} from "../../../hooks/useDehorsAppTheme.ts";
import {useIsCurrentUserSuperAdmin} from "../../../hooks/useIsCurrentUserAdmin.ts";
import {IconLayoutDashboard, IconSettingsCog, IconShield, IconUser} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import classNames from "classnames";
import classes from "./DefaultLayout.module.scss";

// Account and profile pages have no sidebar: these links lead back to the events and between settings.
const HeaderNavigation = () => {
    const location = useLocation();
    const isSuperAdmin = useIsCurrentUserSuperAdmin();

    const links = [
        {to: '/manage/events', label: t`Dashboard`, icon: IconLayoutDashboard, activePath: '/manage/events'},
        {to: '/account/settings', label: t`Account Settings`, icon: IconSettingsCog, activePath: '/account'},
        {to: '/manage/profile', label: t`My Profile`, icon: IconUser, activePath: '/manage/profile'},
        ...(isSuperAdmin ? [{to: '/admin', label: t`Admin Dashboard`, icon: IconShield, activePath: '/admin'}] : []),
    ];

    return (
        <nav className={classes.navigation}>
            {links.map(({to, label, icon: Icon, activePath}) => {
                const isActive = location.pathname.startsWith(activePath);

                return (
                    <NavLink
                        key={to}
                        to={to}
                        className={classNames(classes.navLink, {[classes.navLinkActive]: isActive})}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={label}
                        title={label}
                    >
                        <Icon size={18} stroke={1.75}/>
                        <span className={classes.navLabel}>{label}</span>
                    </NavLink>
                );
            })}
        </nav>
    );
};

const DefaultLayout = () => {
    useDehorsAppTheme();

    return (
        <>
            <ImpersonationBanner />
            <Header
                variant={'floating'}
                rightContent={(
                    <>
                        <HeaderNavigation/>
                        <GlobalMenu/>
                    </>
                )}
            />
            <Container className={classes.main}>
                <Outlet/>
            </Container>
        </>
    );
}

export default DefaultLayout;
