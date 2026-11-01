import {IdParam} from "../../../../../types.ts";
import {useGetAccount} from "../../../../../queries/useGetAccount.ts";
import {useGetOrganizer} from "../../../../../queries/useGetOrganizer.ts";
import {useGetOrganizerSettings} from "../../../../../queries/useGetOrganizerSettings.ts";
import {TaxesAndFeesCard} from "../taxes/TaxesAndFeesCard.tsx";
import {CharityCard} from "../taxes/CharityCard.tsx";
import {SettingsSkeleton} from "./OrganizationTab.tsx";
import classes from "../Settings.module.scss";

// « Taxes et reçus »: the taxes and fees added to products, and the official donation receipts.
export const TaxesTab = ({organizerId}: { organizerId: IdParam }) => {
    const {data: account} = useGetAccount();
    const {data: organizer} = useGetOrganizer(organizerId);
    const {data: settings} = useGetOrganizerSettings(organizerId);

    if (!account || !organizer || !settings) {
        return <SettingsSkeleton/>;
    }

    return (
        <div className={`${classes.grid} ${classes.gridTop}`}>
            <TaxesAndFeesCard currency={account.currency_code || organizer.currency || 'CAD'}/>
            <CharityCard organizerId={organizerId} settings={settings} account={account}/>
        </div>
    );
};
