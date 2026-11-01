import {Avatar, Menu, UnstyledButton} from "@mantine/core";
import {getInitials} from "../../../utilites/helpers.ts";
import {
    IconBuilding,
    IconCreditCard,
    IconLogout,
    IconReceipt,
    IconShield,
    IconUser,
    IconUserShield,
    IconUsers,
} from "@tabler/icons-react";
import {useGetMe} from "../../../queries/useGetMe.ts";
import {Fragment} from "react";
import {NavLink, useParams} from "react-router";
import {SettingsTab, settingsTabLabel, settingsTabPath} from "../../routes/organizer/Settings/settingsTabs.ts";
import {t} from "@lingui/macro";
import {authClient} from "../../../api/auth.client.ts";
import {useStopImpersonating} from "../ImpersonationBanner/useStopImpersonating";

export interface AccountMenuLink {
    label: string;
    icon: any;
    link?: string;
    target?: string;
    onClick?: (event: any) => void;
    // A line above it: the menu reads in groups (profile, settings, the rest).
    dividerBefore?: boolean;
}

export const logout = async () => {
    await authClient.logout();
    localStorage.removeItem("token");
    window.location.href = "/auth/login";
};

// The account links (profile, account, logout…), shared by the avatar menu and the nav's account card.
export const useAccountMenu = () => {
    const {data: me} = useGetMe();
    // The settings of the organizer being viewed; elsewhere /account/... opens the last one's.
    const {organizerId} = useParams();
    const impersonation = useStopImpersonating();

    const links: AccountMenuLink[] = [];

    // A super admin in someone else's account: the way back first.
    if (impersonation.isImpersonating) {
        links.push({
            label: t`Stop Impersonating`,
            icon: IconUserShield,
            onClick: (event: any) => {
                event.preventDefault();
                impersonation.stop();
            },
        });
    }

    // The settings of the organizer being viewed; outside an organizer, /account/<section> opens them
    // for the last one opened.
    const settingsLink = (tab: SettingsTab, icon: any): AccountMenuLink => ({
        label: settingsTabLabel(tab),
        icon,
        link: organizerId ? settingsTabPath(organizerId, tab) : `/account/${tab}`,
    });

    links.push(
        {
            label: t`My Profile`,
            icon: IconUser,
            link: organizerId ? `/manage/organizer/${organizerId}/profile` : "/manage/profile",
        },
        {...settingsLink('organization', IconBuilding), dividerBefore: true},
        settingsLink('payments', IconCreditCard),
        settingsLink('taxes', IconReceipt),
    );

    if (me?.role === 'ADMIN' || me?.role === 'SUPERADMIN') {
        links.push(settingsLink('team', IconUsers));
    }

    const afterSettings = links.length;

    if (me?.role === 'SUPERADMIN') {
        links.push({
            label: t`Admin Dashboard`,
            icon: IconShield,
            link: `/admin`
        })
    }

    // Another organizer is created from the organizer switcher (top of the sidebar), where it reads
    // as what it is: another public page of the same organization.
    links.push({
        label: t`Logout`,
        icon: IconLogout,
        onClick: async (event: any) => {
            event.preventDefault();
            await logout();
        },
    });
    links[afterSettings].dividerBefore = true;

    return {me, links};
};

export const AccountMenuItems = ({links, onNavigate}: { links: AccountMenuLink[], onNavigate?: () => void }) => (
    <>
        {links.map((link) => (
            <Fragment key={link.label}>
                {link.dividerBefore && <Menu.Divider/>}
                <NavLink
                    onClick={(event) => {
                        link.onClick?.(event);
                        if (link.link) {
                            onNavigate?.();
                        }
                    }}
                    to={link.link ?? "#"}
                    end
                    target={link.target ?? ""}
                >
                    {({isActive}) => (
                        <Menu.Item component={"div"} leftSection={<link.icon/>}
                                   data-current={(isActive && link.link) || undefined}>
                            {link.label}
                        </Menu.Item>
                    )}
                </NavLink>
            </Fragment>
        ))}
    </>
);

export const GlobalMenu = () => {
    const {me, links} = useAccountMenu();

    return (
        <>
            <Menu shadow="md" width={200}>
                <Menu.Target>
                    <UnstyledButton>
                        <Avatar color={"primary.1"} radius="xl">
                            {me ? getInitials(me.first_name + " " + me.last_name) : ".."}
                        </Avatar>
                    </UnstyledButton>
                </Menu.Target>

                <Menu.Dropdown>
                    <AccountMenuItems links={links}/>
                </Menu.Dropdown>
            </Menu>
        </>
    );
};
