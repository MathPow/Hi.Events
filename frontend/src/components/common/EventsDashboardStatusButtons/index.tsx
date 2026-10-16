import {Tabs} from "@mantine/core";
import {t} from "@lingui/macro";
import {useNavigate} from "react-router";
import classes from "./EventsDashboardStatusButtons.module.scss";

interface EventsDashboardStatusButtonsProps {
    baseUrl: string;
    eventsState: string;
}

export const EventsDashboardStatusButtons = ({baseUrl, eventsState}: EventsDashboardStatusButtonsProps) => {
    const navigate = useNavigate();

    return (
        <Tabs
            variant={'pills'}
            className={classes.statusTabs}
            value={eventsState || 'upcoming'}
            onChange={(value) => navigate(baseUrl + '/' + value + window.location.search)}
        >
            <Tabs.List>
                <Tabs.Tab value={'upcoming'}>{t`Upcoming`}</Tabs.Tab>
                <Tabs.Tab value={'ended'}>{t`Ended`}</Tabs.Tab>
                <Tabs.Tab value={'archived'}>{t`Archived`}</Tabs.Tab>
            </Tabs.List>
        </Tabs>
    );
}
