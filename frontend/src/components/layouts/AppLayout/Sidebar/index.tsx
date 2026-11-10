import React from "react";
import {Tooltip, UnstyledButton} from '@mantine/core';
import {t} from "@lingui/macro";
import {NavLink} from "react-router";
import classNames from "classnames";
import classes from './Sidebar.module.scss';
import {NavContext, NavItem} from "../types";
import {AccountCard, adminIcon, ContextCard, isHeading, isItemActive, isVisible, NavIcon} from "../NavParts";
import {useScrollFade} from "../../../../hooks/useScrollFade.ts";

interface SidebarProps {
    collapsed: boolean;
    onToggleCollapsed: () => void;
    navItems: NavItem[];
    bottomItems: NavItem[];
    context?: NavContext;
    sidebarFooter?: React.ReactNode;
}

interface NavGroup {
    heading?: string;
    items: NavItem[];
}

const groupItems = (navItems: NavItem[]): NavGroup[] => {
    const groups: NavGroup[] = [{items: []}];

    navItems.forEach((item) => {
        if (isHeading(item)) {
            groups.push({heading: item.label, items: []});
        } else if (isVisible(item)) {
            groups[groups.length - 1].items.push(item);
        }
    });

    return groups.filter((group) => group.items.length > 0);
};

const Marker = ({item, collapsed}: { item: NavItem, collapsed: boolean }) => {
    const hasBadge = item.badge !== undefined && item.badge !== null && item.badge !== '';

    // Folded, only what still needs doing stays visible, as a dot on the icon.
    if (collapsed) {
        return item.attention ? <span className={classNames(classes.dot, classes.iconDot)} aria-hidden/> : null;
    }

    if (hasBadge) {
        return (
            <span className={classNames(classes.badge, {[classes.badgeAttention]: item.attention})}>
                {item.badge}
            </span>
        );
    }

    return item.attention ? <span className={classes.dot} aria-hidden/> : null;
};

export const Sidebar: React.FC<SidebarProps> = ({
                                                    collapsed,
                                                    onToggleCollapsed,
                                                    navItems,
                                                    bottomItems,
                                                    context,
                                                    sidebarFooter,
                                                }) => {
    const navRef = useScrollFade<HTMLElement>();

    const renderItem = (item: NavItem) => {
        if (item.loading) {
            return <span key={item.label} className={classNames(classes.link, classes.loading)}/>;
        }

        // Everything stays in place both ways, the styles show what fits: the sidebar can then
        // open and fold smoothly.
        const content = (
            <>
                <span className={classes.iconSlot}>
                    <NavIcon item={item}/>
                    <Marker item={item} collapsed/>
                </span>
                <span className={classes.label}>{item.label}</span>
                <span className={classes.marker}><Marker item={item} collapsed={false}/></span>
            </>
        );

        let link: React.ReactElement;

        if (!item.link && item.link !== "") {
            link = (
                <UnstyledButton className={classes.link} onClick={item.onClick} aria-label={collapsed ? item.label : undefined}>
                    {content}
                </UnstyledButton>
            );
        } else if (item.external) {
            link = (
                <a href={item.link} target="_blank" rel="noopener" className={classes.link}
                   aria-label={collapsed ? item.label : undefined}>
                    {content}
                </a>
            );
        } else {
            link = (
                <NavLink
                    to={item.comingSoon ? '#' : item.link!}
                    end={item.link === ''}
                    onClick={item.onClick}
                    aria-label={collapsed ? item.label : undefined}
                    className={({isActive}) => classNames(classes.link, {
                        [classes.linkActive]: isItemActive(item, isActive),
                    })}
                >
                    {content}
                </NavLink>
            );
        }

        return (
            <Tooltip key={item.label} label={item.label} position="right" offset={14} disabled={!collapsed} withinPortal>
                {link}
            </Tooltip>
        );
    };

    return (
        <aside className={classNames(classes.sidebar, {[classes.collapsed]: collapsed, [classes.compact]: context?.compact})}
               data-nav-compact={context?.compact || undefined}>
            <div className={classes.top}>
                <div className={classes.brand}>
                    <NavLink to="/manage/events" className={classes.wordmark} tabIndex={collapsed ? -1 : undefined}
                             aria-hidden={collapsed || undefined}>
                        <img src="/logos/billetterie-dehors-wordmark.svg" alt="Billetterie Dehors"/>
                    </NavLink>
                    <UnstyledButton
                        className={classes.collapseButton}
                        onClick={onToggleCollapsed}
                        aria-label={collapsed ? t`Expand sidebar` : t`Collapse sidebar`}
                        aria-expanded={!collapsed}
                        title={collapsed ? t`Expand sidebar` : t`Collapse sidebar`}
                    >
                        <img src={adminIcon('replier')} alt=""/>
                    </UnstyledButton>
                </div>

                {context && <ContextCard context={context} variant={collapsed ? 'collapsed' : 'sidebar'}/>}
            </div>

            <nav ref={navRef} className={classes.nav}>
                {groupItems(navItems).map((group, index) => (
                    <div key={group.heading ?? index} className={classes.group}>
                        {group.heading && (
                            <div className={classes.groupHeading} aria-hidden={collapsed || undefined}>
                                <span>{group.heading}</span>
                            </div>
                        )}
                        {group.items.map(renderItem)}
                    </div>
                ))}
            </nav>

            <div className={classes.bottom}>
                {sidebarFooter && (
                    <div className={classes.footer}>
                        <div className={classes.footerInner}>{sidebarFooter}</div>
                    </div>
                )}
                {bottomItems.map(renderItem)}
                <AccountCard variant={collapsed ? 'collapsed' : 'sidebar'}/>
            </div>
        </aside>
    );
};
