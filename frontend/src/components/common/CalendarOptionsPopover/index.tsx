import {t} from "@lingui/macro";
import {Menu} from "@mantine/core";
import {Event} from "../../../types.ts";
import {createGoogleCalendarUrl, downloadICSFile} from "../../../utilites/calendar.ts";
import {ReactNode} from "react";
import {PublicIcon} from "../PublicIcon";
import classes from "./CalendarOptionsPopover.module.scss";

interface CalendarOptionsPopoverProps {
    event: Event;
    children: ReactNode;
}

// Le choix du calendrier, comme les menus du repertoire: une carte creme, des rangees qui
// passent au creme au survol. Un menu: les fleches et Echap y fonctionnent.
export const CalendarOptionsPopover = ({event, children}: CalendarOptionsPopoverProps) => {
    return (
        <Menu position="bottom" offset={10} width={260} withinPortal
              classNames={{dropdown: classes.menu, label: classes.label, item: classes.option, itemSection: classes.icon}}>
            <Menu.Target>
                {children}
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Label>{t`Choose calendar`}</Menu.Label>
                <Menu.Item
                    leftSection={<PublicIcon name={'calendrier'} size={20}/>}
                    onClick={() => window?.open(createGoogleCalendarUrl(event), '_blank')}
                >
                    {t`Google Calendar`}
                </Menu.Item>
                <Menu.Item
                    leftSection={<PublicIcon name={'telecharger'} size={20}/>}
                    onClick={() => downloadICSFile(event)}
                >
                    {t`Download .ics`}
                </Menu.Item>
            </Menu.Dropdown>
        </Menu>
    );
};
