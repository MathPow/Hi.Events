import React from "react";
import {Drawer, UnstyledButton} from "@mantine/core";
import {useDisclosure} from "@mantine/hooks";
import {IconLayoutGrid} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import {NavLink} from "react-router";
import classNames from "classnames";
import classes from './MobileNav.module.scss';
import {MobilePrimaryAction, NavItem} from "../types.ts";

interface MobileNavProps {
    navItems: NavItem[];
    currentNavItem?: NavItem;
    sheetHeader?: React.ReactNode;
    sheetFooter?: React.ReactNode;
    primaryAction?: MobilePrimaryAction;
}

interface NavGroup {
    heading?: string;
    items: NavItem[];
}

const isHeading = (item: NavItem) => !item.link && item.link !== "" && item.onClick === undefined;

const isVisible = (item: NavItem) => !item.showWhen || item.showWhen();

const groupSheetItems = (navItems: NavItem[]): NavGroup[] => {
    const groups: NavGroup[] = [{items: []}];

    navItems.forEach((item) => {
        if (isHeading(item)) {
            groups.push({heading: item.label, items: []});
        } else if (!item.mobileTab && isVisible(item)) {
            groups[groups.length - 1].items.push(item);
        }
    });

    return groups.filter((group) => group.items.length > 0);
};

const isItemActive = (item: NavItem, isActive: boolean) =>
    (item.isActive ? item.isActive(isActive) : isActive) && !item.comingSoon;

const ItemMarker = ({item}: { item: NavItem }) => {
    if (item.badge !== undefined && item.badge !== null) {
        return (
            <span className={classNames(classes.badge, {[classes.badgeAttention]: item.attention})}>
                {item.badge}
            </span>
        );
    }

    return item.attention ? <span className={classes.dot} aria-hidden/> : null;
};

export const MobileNav: React.FC<MobileNavProps> = ({
                                                        navItems,
                                                        currentNavItem,
                                                        sheetHeader,
                                                        sheetFooter,
                                                        primaryAction,
                                                    }) => {
    const [sheetOpen, {open: openSheet, close: closeSheet}] = useDisclosure(false);

    const tabs = navItems.filter((item) => item.mobileTab && !isHeading(item) && isVisible(item));
    const groups = groupSheetItems(navItems);
    const sheetNeedsAttention = groups.some((group) => group.items.some((item) => item.attention));
    const isSheetPageActive = !!currentNavItem && !currentNavItem.mobileTab;

    const renderTile = (item: NavItem) => {
        const content = (
            <>
                <span className={classes.tileIcon}>
                    {item.icon && <item.icon size={22} stroke={1.6}/>}
                    <ItemMarker item={item}/>
                </span>
                <span className={classes.tileLabel}>{item.label}</span>
            </>
        );

        if (item.loading) {
            return <span key={item.label} className={classNames(classes.tile, classes.tileLoading)}/>;
        }

        if (!item.link && item.link !== "") {
            return (
                <UnstyledButton
                    key={item.label}
                    className={classes.tile}
                    onClick={() => {
                        closeSheet();
                        item.onClick?.();
                    }}
                >
                    {content}
                </UnstyledButton>
            );
        }

        return (
            <NavLink
                key={item.label}
                to={item.comingSoon ? '#' : item.link}
                end={item.link === ''}
                onClick={() => {
                    closeSheet();
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
                <UnstyledButton className={classes.primaryAction} onClick={primaryAction.onClick}>
                    <primaryAction.icon size={20} stroke={2}/>
                    <span>{primaryAction.label}</span>
                </UnstyledButton>
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
                            [classes.tabActive]: !sheetOpen && isItemActive(item, isActive),
                        })}
                    >
                        <span className={classes.tabIcon}>
                            {item.icon && <item.icon size={22} stroke={1.6}/>}
                            {item.attention && <span className={classes.dot} aria-hidden/>}
                        </span>
                        <span className={classes.tabLabel}>{item.mobileTabLabel ?? item.label}</span>
                    </NavLink>
                ))}

                <UnstyledButton
                    className={classNames(classes.tab, {[classes.tabActive]: sheetOpen || isSheetPageActive})}
                    onClick={openSheet}
                    aria-expanded={sheetOpen}
                >
                    <span className={classes.tabIcon}>
                        <IconLayoutGrid size={22} stroke={1.6}/>
                        {sheetNeedsAttention && <span className={classes.dot} aria-hidden/>}
                    </span>
                    <span className={classes.tabLabel}>{t`Menu`}</span>
                </UnstyledButton>
            </nav>

            <Drawer
                opened={sheetOpen}
                onClose={closeSheet}
                position="bottom"
                size="auto"
                title={t`Menu`}
                classNames={{
                    content: classes.sheet,
                    header: classes.sheetHeader,
                    title: classes.sheetTitle,
                    body: classes.sheetBody,
                }}
                overlayProps={{backgroundOpacity: 0.45, blur: 2}}
            >
                {sheetHeader && <div className={classes.sheetActions} onClick={closeSheet}>{sheetHeader}</div>}

                {groups.map((group, index) => (
                    <section key={group.heading ?? index} className={classes.group}>
                        {group.heading && <h3 className={classes.groupHeading}>{group.heading}</h3>}
                        <div className={classes.grid}>
                            {group.items.map(renderTile)}
                        </div>
                    </section>
                ))}

                {sheetFooter && <div className={classes.sheetFooter}>{sheetFooter}</div>}
            </Drawer>
        </>
    );
};
