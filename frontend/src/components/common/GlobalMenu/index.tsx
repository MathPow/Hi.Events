import {Avatar, Menu, UnstyledButton} from "@mantine/core";
import {getInitials} from "../../../utilites/helpers.ts";
import {
    IconLifebuoy,
    IconLogout,
    IconSettingsCog,
    IconShield,
    IconUser,
    IconUserShield,
    IconUsers,
} from "@tabler/icons-react";
import {useGetMe} from "../../../queries/useGetMe.ts";
import {NavLink, useParams} from "react-router";
import {settingsTabPath} from "../../routes/organizer/Settings/settingsTabs.ts";
import {t} from "@lingui/macro";
import {authClient} from "../../../api/auth.client.ts";
import {useDisclosure} from "@mantine/hooks";
import {AboutModal} from "../../modals/AboutModal";
import {getConfig} from "../../../utilites/config.ts";
import {useStopImpersonating} from "../ImpersonationBanner/useStopImpersonating";

export interface AccountMenuLink {
    label: string;
    icon: any;
    link?: string;
    target?: string;
    onClick?: (event: any) => void;
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
    const [aboutModalOpen, {open: openAboutModal, close: closeAboutModal}] = useDisclosure(false);

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

    links.push(
        {
            label: t`My Profile`,
            icon: IconUser,
            link: "/manage/profile",
        },
        {
            label: t`Settings`,
            icon: IconSettingsCog,
            link: organizerId ? settingsTabPath(organizerId, 'organization') : '/account',
        },
    );

    if (me?.role === 'ADMIN' || me?.role === 'SUPERADMIN') {
        links.push({
            label: t`Team`,
            icon: IconUsers,
            link: organizerId ? settingsTabPath(organizerId, 'team') : '/account/users',
        })
    }

    if (me?.role === 'SUPERADMIN') {
        links.push({
            label: t`Admin Dashboard`,
            icon: IconShield,
            link: `/admin`
        })
    }

    if (!getConfig("VITE_HIDE_ABOUT_LINK")) {
        links.push({
            label: `About & Support`,
            icon: IconLifebuoy,
            onClick: openAboutModal,
        });
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

    const modals = (
        <>
            {aboutModalOpen && <AboutModal onClose={closeAboutModal}/>}
        </>
    );

    return {me, links, modals};
};

export const AccountMenuItems = ({links}: { links: AccountMenuLink[] }) => (
    <>
        {links.map((link) => (
            <NavLink
                onClick={link.onClick}
                to={link.link ?? "#"}
                key={link.label}
                target={link.target ?? ""}
            >
                <Menu.Item component={"div"} leftSection={<link.icon/>}>
                    {link.label}
                </Menu.Item>
            </NavLink>
        ))}
    </>
);

export const GlobalMenu = () => {
    const {me, links, modals} = useAccountMenu();

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
            {modals}
        </>
    );
};
