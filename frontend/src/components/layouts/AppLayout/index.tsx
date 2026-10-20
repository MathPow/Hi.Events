import React, {useEffect, useState} from "react";
import {Outlet, useLocation} from "react-router";
import classes from './AppLayout.module.scss';
import {Topbar} from "./Topbar";
import {Sidebar} from "./Sidebar";
import {BreadcrumbItem, MobileContext, MobilePrimaryAction, NavItem} from "./types.ts";
import {MobileNav} from "./MobileNav";
import {IconLayoutSidebar} from "@tabler/icons-react";
import {UnstyledButton, VisuallyHidden} from "@mantine/core";
import {t} from "@lingui/macro";
import ImpersonationBanner from "../../common/ImpersonationBanner";
import {useDehorsAppTheme} from "../../../hooks/useDehorsAppTheme.ts";

interface AppLayoutProps {
    navItems: NavItem[];
    breadcrumbItems: BreadcrumbItem[];
    entityType: 'event' | 'organizer';
    topBarContent?: React.ReactNode;
    breadcrumbContentRight?: React.ReactNode;
    actionGroupContent?: React.ReactNode;
    sidebarFooter?: React.ReactNode;
    mobileContext?: MobileContext;
    mobilePrimaryAction?: MobilePrimaryAction;
    mobileSheetActions?: React.ReactNode;
}

interface SidebarToggleButtonProps {
    open: boolean;
    onClick: () => void;
}

const SidebarToggleButton: React.FC<SidebarToggleButtonProps> = ({open, onClick}) => {
    const Icon = IconLayoutSidebar;
    const label = t`Open sidebar`;

    return (
        <UnstyledButton
            className={open ? classes.sidebarOpen : classes.sidebarClose}
            onClick={onClick}
        >
            <Icon size={16}/>
            <VisuallyHidden>{label}</VisuallyHidden>
        </UnstyledButton>
    );
};

// The sidebar entry for the current page, so the breadcrumbs can end with where the user is.
const findCurrentNavItem = (navItems: NavItem[], pathname: string): NavItem | undefined => {
    const segments = pathname.split('/');

    return navItems.find((item) => {
        if (!item.link || item.link.startsWith('/')) {
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
                                                 topBarContent = null,
                                                 breadcrumbContentRight = null,
                                                 actionGroupContent = null,
                                                 sidebarFooter = null,
                                                 mobileContext,
                                                 mobilePrimaryAction,
                                                 mobileSheetActions,
                                             }) => {
    useDehorsAppTheme();
    const location = useLocation();
    const currentNavItem = findCurrentNavItem(navItems, location.pathname);
    const breadcrumbsWithCurrentPage = currentNavItem
        ? [...breadcrumbItems, {content: currentNavItem.label}]
        : breadcrumbItems;
    const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true; // SSR default
        return window.innerWidth >= 768; // Desktop open, mobile closed
    });
    const [topBarShadow, setTopBarShadow] = useState<boolean>(false);

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

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setSidebarOpen(true);
            } else {
                setSidebarOpen(false);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <>
            <ImpersonationBanner />
            <div id={`${entityType}-manage-container`}
                 className={`${classes.container} ${sidebarOpen ? classes.open : classes.closed} ${mobilePrimaryAction ? classes.withPrimaryAction : ''}`}>
                <Topbar
                    topBarShadow={topBarShadow}
                    breadcrumbItems={breadcrumbsWithCurrentPage}
                    topBarContent={topBarContent}
                    breadcrumbContentRight={breadcrumbContentRight}
                    actionGroupContent={actionGroupContent}
                    mobileContext={mobileContext}
                />

            <div className={classes.main} id={'app-manage-main'}>
                <Outlet/>
            </div>

            <Sidebar
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                navItems={navItems}
                sidebarFooter={sidebarFooter}
            />

            <MobileNav
                navItems={navItems}
                currentNavItem={currentNavItem}
                sheetHeader={mobileSheetActions}
                sheetFooter={sidebarFooter}
                primaryAction={mobilePrimaryAction}
            />

            {!sidebarOpen && (
                <SidebarToggleButton
                    open={false}
                    onClick={() => setSidebarOpen(true)}
                />
            )}
            </div>
        </>
    );
};

export default AppLayout;
