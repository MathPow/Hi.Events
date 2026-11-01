import {Menu, UnstyledButton} from "@mantine/core";
import {t} from "@lingui/macro";
import classNames from "classnames";
import {getInitials} from "../../../../utilites/helpers.ts";
import {AccountMenuItems, useAccountMenu} from "../../../common/GlobalMenu";
import {NavContext, NavItem} from "../types.ts";
import classes from './NavParts.module.scss';

export const adminIcon = (name: string) => `/interface/admin/${name}.svg`;

export type NavPartVariant = 'sidebar' | 'collapsed' | 'menu';

export const isHeading = (item: NavItem) => !item.link && item.link !== "" && item.onClick === undefined;

export const isVisible = (item: NavItem) => !item.showWhen || item.showWhen();

export const isItemActive = (item: NavItem, isActive: boolean) =>
    (item.isActive ? item.isActive(isActive) : isActive) && !item.comingSoon;

// The DEHORS drawings keep their own size; the Tabler fallbacks get the same weight.
export const NavIcon = ({item, tile = false}: { item: NavItem, tile?: boolean }) => {
    const src = tile ? (item.tileIconSrc ?? item.iconSrc) : item.iconSrc;

    if (src) {
        return <img src={src} alt="" className={classes.icon}/>;
    }

    if (item.icon) {
        return <item.icon size={tile ? 22 : 20} stroke={2.25} className={classes.icon}/>;
    }

    return null;
};

export const ContextCard = ({context, variant}: { context: NavContext, variant: NavPartVariant }) => {
    const subtitle = variant === 'menu' ? (context.mobileSubtitle ?? context.subtitle) : context.subtitle;
    const label = typeof context.title === 'string' ? context.title : undefined;

    const body = (
        <>
            <span className={classes.contextAvatar}>{context.initial}</span>
            {/* Folded, the texts stay (hidden) so the sidebar can open and fold smoothly. */}
            <span className={classes.cardText}>
                <span className={classes.cardTitle}>{context.title}</span>
                {subtitle && <span className={classes.cardSubtitle}>{subtitle}</span>}
            </span>
            {context.menu && <img src={adminIcon('changer')} alt="" className={classes.cardTrailing}/>}
        </>
    );

    const className = classNames(classes.card, classes.contextCard, classes[variant]);

    if (!context.menu) {
        return <div className={className} title={variant === 'collapsed' ? label : undefined}>{body}</div>;
    }

    return (
        <Menu
            position={variant === 'menu' ? 'bottom' : 'right-start'}
            offset={variant === 'menu' ? 8 : 12}
            width={variant === 'menu' ? 'target' : 300}
            shadow="md"
            withinPortal
        >
            <Menu.Target>
                <UnstyledButton className={className} aria-label={label} title={variant === 'collapsed' ? label : undefined}>
                    {body}
                </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>{context.menu}</Menu.Dropdown>
        </Menu>
    );
};

export const AccountCard = ({variant, onNavigate}: { variant: NavPartVariant, onNavigate?: () => void }) => {
    const {me, links} = useAccountMenu();
    const name = me ? `${me.first_name} ${me.last_name ?? ''}`.trim() : '…';
    const initials = me ? getInitials(name) : '..';

    const identity = (
        <>
            <span className={classes.accountAvatar}>{initials}</span>
            <span className={classes.cardText}>
                <span className={classes.cardTitle}>{name}</span>
                <span className={classes.cardSubtitle}>{t`My Profile`}</span>
            </span>
        </>
    );

    // On phones the card opens the same menu, above it (it sits at the bottom of the menu sheet).
    if (variant === 'menu') {
        return (
            <>
                <Menu position="top" offset={8} width="target" shadow="md" withinPortal>
                    <Menu.Target>
                        <UnstyledButton className={classNames(classes.card, classes.accountCard, classes.menu)}
                                        aria-label={t`Account`}>
                            {identity}
                            <img src={adminIcon('plus')} alt="" className={classes.cardTrailing}/>
                        </UnstyledButton>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <AccountMenuItems links={links} onNavigate={onNavigate}/>
                    </Menu.Dropdown>
                </Menu>
            </>
        );
    }

    return (
        <>
            <Menu position="right-end" offset={12} width={270} shadow="md" withinPortal>
                <Menu.Target>
                    <UnstyledButton className={classNames(classes.card, classes.accountCard, classes[variant])}
                                    aria-label={t`Account`} title={variant === 'collapsed' ? name : undefined}>
                        {identity}
                        <img src={adminIcon('plus')} alt="" className={classes.cardTrailing}/>
                    </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown>
                    <AccountMenuItems links={links}/>
                </Menu.Dropdown>
            </Menu>
        </>
    );
};
