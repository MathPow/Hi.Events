import {Menu} from "@mantine/core";
import {t} from "@lingui/macro";
import {useNavigate} from "react-router";
import {IconArchive, IconBuilding, IconCheck, IconPlus} from "@tabler/icons-react";
import {IdParam, Organizer, OrganizerStatus} from "../../../types.ts";
import {useGetMyAccounts} from "../../../queries/useGetMyAccounts.ts";
import {useSwitchAccount} from "../../../mutations/useSwitchAccount.ts";
import classes from "./OrganizerLayout.module.scss";

const initial = (name?: string) => name?.trim().charAt(0).toUpperCase() || '…';

export const organizerLogo = (organizer?: Organizer) => organizer?.images?.find((image) => image.type === 'ORGANIZER_LOGO')?.url;

const OrganizerAvatar = ({organizer}: { organizer: Organizer }) => {
    const logo = organizerLogo(organizer);

    return logo
        ? <img src={logo} alt="" className={`${classes.menuInitial} ${classes.menuLogo}`}/>
        : <span className={classes.menuInitial}>{initial(organizer.name)}</span>;
};

// The other accounts the person belongs to (another club, a client): one click opens it, no new login.
const OtherAccounts = () => {
    const {data: accounts} = useGetMyAccounts();
    const switchAccount = useSwitchAccount();
    const others = (accounts ?? []).filter((account) => !account.is_current);

    if (others.length === 0) {
        return null;
    }

    return (
        <>
            <Menu.Divider/>
            <Menu.Label>{t`Other accounts`}</Menu.Label>
            {others.map((account) => (
                <Menu.Item key={account.id} leftSection={<IconBuilding size={16}/>}
                           disabled={switchAccount.isPending}
                           onClick={() => switchAccount.mutate(account.id)}>
                    {account.name}
                </Menu.Item>
            ))}
        </>
    );
};

/**
 * The organizer switcher (the card at the top of the sidebar, and of the phone menu): the account's
 * other organizers, creating one, and the person's other accounts. It's the only place an organizer
 * is created: what it is reads here, another public page of the same organization.
 */
export const OrganizerSwitcherMenu = ({organizerId, organizers, onCreateOrganizer, onShowArchived}: {
    organizerId: IdParam;
    organizers: Organizer[];
    onCreateOrganizer: () => void;
    onShowArchived: () => void;
}) => {
    const navigate = useNavigate();
    const active = organizers.filter((organizer) => organizer.status !== OrganizerStatus.ARCHIVED);
    const archivedCount = organizers.length - active.length;

    return (
        <>
            {active.length > 1 && (
                <>
                    <Menu.Label>{t`Organizers`}</Menu.Label>
                    {active.map((organizer) => {
                        const current = String(organizer.id) === String(organizerId);
                        return (
                            <Menu.Item key={organizer.id}
                                       leftSection={<OrganizerAvatar organizer={organizer}/>}
                                       rightSection={current ? <IconCheck size={16}/> : undefined}
                                       aria-current={current || undefined}
                                       onClick={() => !current && navigate(`/manage/organizer/${organizer.id}/dashboard`)}>
                                {organizer.name}
                            </Menu.Item>
                        );
                    })}
                </>
            )}
            {archivedCount > 0 && (
                <Menu.Item leftSection={<IconArchive size={16}/>} onClick={onShowArchived}>
                    {t`Archived Organizers`} ({archivedCount})
                </Menu.Item>
            )}
            <Menu.Item leftSection={<IconPlus size={16}/>} onClick={onCreateOrganizer}>
                <span className={classes.menuItemText}>
                    <span>{t`Create Organizer`}</span>
                    <span className={classes.menuHint}>{t`Another public page for the same organization, with the same team.`}</span>
                </span>
            </Menu.Item>
            <OtherAccounts/>
        </>
    );
};
