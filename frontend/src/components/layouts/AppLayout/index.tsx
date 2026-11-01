import React, {useEffect, useState} from "react";
import {Outlet, useLocation} from "react-router";
import {t} from "@lingui/macro";
import {Helmet} from "react-helmet-async";
import classNames from "classnames";
import classes from './AppLayout.module.scss';
import {Topbar} from "./Topbar";
import {Sidebar} from "./Sidebar";
import {BreadcrumbItem, MobilePrimaryAction, NavContext, NavItem} from "./types.ts";
import {MobileNav} from "./MobileNav";
import {adminIcon} from "./NavParts";
import ImpersonationBanner from "../../common/ImpersonationBanner";
import {InstallAppPrompt} from "../../common/InstallAppPrompt";
import {useDehorsAppTheme} from "../../../hooks/useDehorsAppTheme.ts";
import {PageStatusProvider} from "./PageStatus.tsx";

interface AppLayoutProps {
    navItems: NavItem[];
    breadcrumbItems: BreadcrumbItem[];
    entityType: 'event' | 'organizer';
    navContext?: NavContext;
    // Next to the breadcrumbs, on phones too (the draft status).
    topBarContent?: React.ReactNode;
    // Right of the top bar, desktop only (create, share…).
    topBarActions?: React.ReactNode;
    sidebarFooter?: React.ReactNode;
    // Extra tiles of the phone menu, after the pages.
    mobileMenuItems?: NavItem[];
    mobileMenuGrouped?: boolean;
    mobilePrimaryAction?: MobilePrimaryAction;
}

const COLLAPSED_STORAGE_KEY = 'dehors-nav-collapsed';

// The sidebar entry for the current page, so the breadcrumbs can end with where the user is.
const findCurrentNavItem = (navItems: NavItem[], pathname: string): NavItem | undefined => {
    const segments = pathname.split('/');

    return navItems.find((item) => {
        if (!item.link || item.link.startsWith('/') || item.external) {
            return false;
        }
        const isInPath = segments.includes(item.link);
        return item.isActive ? item.isActive(isInPath) : isInPath;
    });
};

const AppLayout: React.FC<AppLayoutProps> = ({
                                                 navItems,
                                                 breadcrumbItems,
                                                 entityType,
                                                 navContext,
                                                 topBarContent = null,
                                                 topBarActions = null,
                                                 sidebarFooter = null,
                                                 mobileMenuItems = [],
                                                 mobileMenuGrouped = false,
                                                 mobilePrimaryAction,
                                             }) => {
    useDehorsAppTheme();
    const location = useLocation();
    const currentNavItem = findCurrentNavItem(navItems, location.pathname);
    // The page may add a detail to its name (« Paramètres / Organisation »).
    const breadcrumbsWithCurrentPage = (detail: string | null) => currentNavItem
        ? [...breadcrumbItems, {content: detail ? `${currentNavItem.label} / ${detail}` : currentNavItem.label}]
        : breadcrumbItems;
    const [collapsed, setCollapsed] = useState(false);
    const [topBarShadow, setTopBarShadow] = useState<boolean>(false);

    const helpItem: NavItem = {
        label: t`Help center`,
        iconSrc: adminIcon('aide'),
        tileIconSrc: adminIcon('aide-22'),
        link: '/help',
    };

    // Read after the first render: the server does not know the choice.
    useEffect(() => {
        try {
            setCollapsed(localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1');
        } catch {
            // localStorage unavailable
        }
    }, []);

    const toggleCollapsed = () => {
        setCollapsed((current) => {
            try {
                localStorage.setItem(COLLAPSED_STORAGE_KEY, current ? '0' : '1');
            } catch {
                // localStorage unavailable
            }
            return !current;
        });
    };

    useEffect(() => {
        const mainElement = document.getElementById('app-manage-main');
        if (mainElement) {
            const handleScroll = () => {
                setTopBarShadow(mainElement.scrollTop > 10);
            };
            mainElement.addEventListener('scroll', handleScroll);
            return () => mainElement.removeEventListener('scroll', handleScroll);
        }
    }, []);

    return (
        <>
            {/* Only the back office is installable: an attendee saving an event page keeps a plain bookmark. */}
            <Helmet>
                <link rel="manifest" href="/site.webmanifest"/>
                <meta name="mobile-web-app-capable" content="yes"/>
                <meta name="apple-mobile-web-app-capable" content="yes"/>
                <meta name="apple-mobile-web-app-title" content="DEHORS"/>
                <meta name="apple-mobile-web-app-status-bar-style" content="default"/>
            </Helmet>
            <ImpersonationBanner/>
            <div id={`${entityType}-manage-container`}
                 className={classNames(classes.container, {
                     [classes.collapsed]: collapsed,
                     [classes.withPrimaryAction]: !!mobilePrimaryAction,
                 })}>
                <PageStatusProvider render={(status) => (
                    <Topbar
                        topBarShadow={topBarShadow}
                        breadcrumbItems={breadcrumbsWithCurrentPage(status.detail)}
                        topBarContent={topBarContent}
                        saveStatus={status.save}
                        actions={topBarActions}
                    />
                )}>
                    <div className={classes.main} id={'app-manage-main'}>
                        <Outlet/>
                    </div>
                </PageStatusProvider>

                <Sidebar
                    collapsed={collapsed}
                    onToggleCollapsed={toggleCollapsed}
                    navItems={navItems}
                    bottomItems={[helpItem]}
                    context={navContext}
                    sidebarFooter={sidebarFooter}
                />

                <MobileNav
                    navItems={navItems}
                    menuItems={[helpItem, ...mobileMenuItems]}
                    currentNavItem={currentNavItem}
                    context={navContext}
                    menuFooter={sidebarFooter}
                    primaryAction={mobilePrimaryAction}
                    groupedMenu={mobileMenuGrouped}
                />

                <InstallAppPrompt/>
            </div>
        </>
    );
};

export default AppLayout;
