import {t} from "@lingui/macro";
import {useGetAccount} from "../../../../../queries/useGetAccount.ts";
import {useCanSeeDeveloperPages, useIsCurrentUserAdmin} from "../../../../../hooks/useIsCurrentUserAdmin.ts";
import {MembersCard} from "../team/MembersCard.tsx";
import {AccountCard} from "../team/AccountCard.tsx";
import {ApiTokensCard} from "../team/ApiTokensCard.tsx";
import {SettingsCard} from "../SettingsUi.tsx";
import {TeamTabSkeleton} from "./TabSkeletons.tsx";
import classes from "../Settings.module.scss";

// « Équipe »: the people of the account and their roles, the account itself, and the API tokens.
export const TeamTab = () => {
    const {data: account} = useGetAccount();
    const isAdmin = useIsCurrentUserAdmin();
    const canSeeDeveloperPages = useCanSeeDeveloperPages();

    if (!account) {
        return <TeamTabSkeleton showTokens={isAdmin && canSeeDeveloperPages}/>;
    }

    return (
        <div className={`${classes.grid} ${classes.gridTop}`}>
            {isAdmin ? <MembersCard/> : (
                <SettingsCard full title={t`Team members`}>
                    <p className={classes.bodyText}>{t`Only account administrators can invite people and change their roles.`}</p>
                </SettingsCard>
            )}
            <AccountCard account={account} isAdmin={isAdmin}/>
            {isAdmin && canSeeDeveloperPages && <ApiTokensCard/>}
        </div>
    );
};
