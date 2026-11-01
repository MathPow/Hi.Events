import {Avatar, Menu, UnstyledButton} from "@mantine/core";
import {getInitials} from "../../../utilites/helpers.ts";
import {
    IconLifebuoy,
    IconLogout,
    IconPlus,
    IconSettingsCog,
    IconShield,
    IconUser,
    IconUsers,
} from "@tabler/icons-react";
import {useGetMe} from "../../../queries/useGetMe.ts";
import {NavLink} from "react-router";
import {t} from "@lingui/macro";
import {authClient} from "../../../api/auth.client.ts";
import {useDisclosure} from "@mantine/hooks";
import {AboutModal} from "../../modals/AboutModal";
import {getConfig} from "../../../utilites/config.ts";
import {CreateOrganizerModal} from "../../modals/CreateOrganizerModal";

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
    const [aboutModalOpen, {open: openAboutModal, close: closeAboutModal}] = useDisclosure(false);
    const [createOrganizerModalOpen, {
        open: openCreateOrganizerModal,
        close: closeCreateOrganizerModal
    }] = useDisclosure(false);

    const links: AccountMenuLink[] = [
        {
            label: t`My Profile`,
            icon: IconUser,
            link: "/manage/profile",
        },
        {
            label: t`Account Settings`,
            icon: IconSettingsCog,
            link: `/account/settings`,
        },
    ];

    if (me?.role === 'ADMIN' || me?.role === 'SUPERADMIN') {
        links.push({
            label: t`User Management`,
            icon: IconUsers,
            link: `/account/users`
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

    links.push({
        label: t`Create Organizer`,
        icon: IconPlus,
        onClick: (event: any) => {
            event.preventDefault();
            openCreateOrganizerModal();
        }
    });

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
            {createOrganizerModalOpen && <CreateOrganizerModal onClose={closeCreateOrganizerModal}/>}
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
