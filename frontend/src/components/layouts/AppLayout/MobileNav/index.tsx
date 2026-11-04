import React, {useEffect, useState} from "react";
import {Button, UnstyledButton} from "@mantine/core";
import {IconUserShield} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import {NavLink, useLocation} from "react-router";
import classNames from "classnames";
import classes from './MobileNav.module.scss';
import {MobilePrimaryAction, NavContext, NavItem} from "../types.ts";
import {AccountCard, adminIcon, ContextCard, isHeading, isItemActive, isVisible, NavIcon} from "../NavParts";
import {useStopImpersonating} from "../../../common/ImpersonationBanner/useStopImpersonating";
import {toggleAssistant, useAssistantState} from "../../../../utilites/assistantEvents.ts";
import {useScrollFade} from "../../../../hooks/useScrollFade.ts";

interface MobileNavProps {
    navItems: NavItem[];
    // Tiles added after the pages: help center, public page…
    menuItems: NavItem[];
    currentNavItem?: NavItem;
    context?: NavContext;
    menuFooter?: React.ReactNode;
    primaryAction?: MobilePrimaryAction;
    // Keeps the section headings in the menu (event pages, which have many).
    groupedMenu?: boolean;
}

interface NavGroup {
    heading?: string;
    items: NavItem[];
}

// The bar holds three pages, then the assistant and the menu; other pages go in the menu.
const MAX_PAGE_TABS = 3;

const groupMenuItems = (navItems: NavItem[], tabs: NavItem[], grouped: boolean): NavGroup[] => {
    const groups: NavGroup[] = [{items: []}];

    navItems.forEach((item) => {
        if (isHeading(item)) {
            if (grouped) {
                groups.push({heading: item.label, items: []});
            }
        } else if (!tabs.includes(item) && isVisible(item)) {
            groups[groups.length - 1].items.push(item);
        }
    });

    return groups.filter((group) => group.items.length > 0);
};

const TileMarker = ({item}: { item: NavItem }) => {
    if (item.badge !== undefined && item.badge !== null && item.badge !== '') {
        return (
            <span className={classNames(classes.badge, {[classes.badgeAttention]: item.attention})}>
                {item.badge}
            </span>
        );
    }

    return item.attention ? <span className={classes.dot} aria-hidden/> : null;
};

// Figma « Admin · Navigation mobile » and « Menu ouvert »: a tab bar at the bottom, the rest in a brown card above it.
export const MobileNav: React.FC<MobileNavProps> = ({
                                                        navItems,
                                                        menuItems,
                                                        currentNavItem,
                                                        context,
                                                        menuFooter,
                                                        primaryAction,
                                                        groupedMenu = false,
                                                    }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const assistant = useAssistantState();
    const {pathname} = useLocation();
    const closeMenu = () => setMenuOpen(false);
    const impersonation = useStopImpersonating();
    const menuScrollRef = useScrollFade<HTMLDivElement>(menuOpen);

    useEffect(closeMenu, [pathname]);

    useEffect(() => {
        if (!menuOpen) {
            return;
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeMenu();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [menuOpen]);

    const tabs = navItems
        .filter((item) => item.mobileTab && !isHeading(item) && isVisible(item))
        .map((item, index) => ({item, order: item.mobileTabOrder ?? index}))
        .sort((a, b) => a.order - b.order)
        .slice(0, MAX_PAGE_TABS)
        .map(({item}) => item);
    const groups = groupMenuItems(navItems, tabs, groupedMenu);
    if (menuItems.length > 0) {
        groups.push({items: menuItems});
    }
    const menuNeedsAttention = groups.some((group) => group.items.some((item) => item.attention));
    const isMenuPageActive = !!currentNavItem && !tabs.includes(currentNavItem);

    const renderTile = (item: NavItem) => {
        if (item.loading) {
            return <span key={item.label} className={classNames(classes.tile, classes.tileLoading)}/>;
        }

        const content = (
            <>
                <span className={classes.tileTop}>
                    <NavIcon item={item} tile/>
                    <TileMarker item={item}/>
                </span>
                <span className={classes.tileLabel}>{item.label}</span>
            </>
        );

        if (!item.link && item.link !== "") {
            return (
                <UnstyledButton
                    key={item.label}
                    className={classes.tile}
                    onClick={() => {
                        closeMenu();
                        item.onClick?.();
                    }}
                >
                    {content}
                </UnstyledButton>
            );
        }

        if (item.external) {
            return (
                <a key={item.label} href={item.link} target="_blank" rel="noopener" className={classes.tile}
                   onClick={closeMenu}>
                    {content}
                </a>
            );
        }

        return (
            <NavLink
                key={item.label}
                to={item.comingSoon ? '#' : item.link!}
                end={item.link === ''}
                onClick={() => {
                    closeMenu();
                    item.onClick?.();
                }}
                className={({isActive}) => classNames(classes.tile, {
                    [classes.tileActive]: isItemActive(item, isActive),
                })}
            >
                {content}
            </NavLink>
        );
    };

    return (
        <>
            {primaryAction && (
                <UnstyledButton className={classes.primaryAction} onClick={primaryAction.onClick} data-primary-action>
                    <primaryAction.icon size={20} stroke={2}/>
                    <span>{primaryAction.label}</span>
                </UnstyledButton>
            )}

            {menuOpen && (
                <>
                    <div className={classes.veil} onClick={closeMenu} aria-hidden/>
                    <div className={classes.menu} id="mobile-nav-menu" role="dialog" aria-modal="true"
                         aria-label={t`Menu`}>
                        <div ref={menuScrollRef} className={classes.menuScroll}>
                            <div className={classes.menuHeading}>{t`Menu`}</div>

                            {context && <ContextCard context={context} variant="menu"/>}

                            {groups.map((group, index) => (
                                <section key={group.heading ?? index} className={classes.group}>
                                    {group.heading && <h3 className={classes.menuHeading}>{group.heading}</h3>}
                                    <div className={classes.grid}>
                                        {group.items.map(renderTile)}
                                    </div>
                                </section>
                            ))}

                            {menuFooter && <div className={classes.menuFooter}>{menuFooter}</div>}

                            {impersonation.isImpersonating && (
                                <Button variant="white" color="orange" fullWidth loading={impersonation.isPending}
                                        leftSection={<IconUserShield size={18}/>} onClick={impersonation.stop}
                                        style={{flexShrink: 0}}>
                                    {t`Stop Impersonating`}
                                </Button>
                            )}

                            <AccountCard variant="menu" onNavigate={closeMenu}/>
                        </div>
                    </div>
                </>
            )}

            <nav className={classes.tabBar} aria-label={t`Menu`}>
                {tabs.map((item) => item.loading ? (
                    <span key={item.label} className={classNames(classes.tab, classes.tabLoading)}/>
                ) : (
                    <NavLink
                        key={item.label}
                        to={item.link ?? '#'}
                        end={item.link === ''}
                        onClick={item.onClick}
                        className={({isActive}) => classNames(classes.tab, {
                            [classes.tabActive]: !menuOpen && isItemActive(item, isActive),
                        })}
                    >
                        <span className={classes.tabIcon}>
                            <NavIcon item={item}/>
                            {item.attention && <span className={classes.dot} aria-hidden/>}
                        </span>
                        <span className={classes.tabLabel}>{item.mobileTabLabel ?? item.label}</span>
                    </NavLink>
                ))}

                {/* The assistant (components/common/Assistant): its round button becomes this tab. It is
                    there from the start; a tap before the assistant has loaded opens it once loaded. */}
                <UnstyledButton
                    className={classNames(classes.tab, {[classes.tabActive]: assistant.open})}
                    onClick={() => {
                        setMenuOpen(false);
                        toggleAssistant();
                    }}
                    aria-expanded={assistant.open}
                    data-assistant-tab
                    data-busy={assistant.busy || undefined}
                >
                    <span className={classes.tabIcon}>
                        <img className={classes.assistantIcon} src={'/interface/admin/stagiaire.svg'} width={19} height={22}
                             alt="" aria-hidden/>
                    </span>
                    <span className={classes.tabLabel}>{t`Assistant`}</span>
                </UnstyledButton>

                <UnstyledButton
                    className={classNames(classes.tab, {[classes.tabActive]: menuOpen || isMenuPageActive})}
                    onClick={() => setMenuOpen(!menuOpen)}
                    aria-expanded={menuOpen}
                    aria-controls="mobile-nav-menu"
                >
                    <span className={classes.tabIcon}>
                        <img src={adminIcon('menu')} alt=""/>
                        {menuNeedsAttention && <span className={classes.dot} aria-hidden/>}
                    </span>
                    <span className={classes.tabLabel}>{t`Menu`}</span>
                </UnstyledButton>
            </nav>
        </>
    );
};
