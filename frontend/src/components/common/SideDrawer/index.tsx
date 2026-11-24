import {Drawer, Modal, UnstyledButton} from "@mantine/core";
import {useMediaQuery} from "@mantine/hooks";
import {IconX} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import React from "react";
import classes from "./SideDrawer.module.scss";

interface SideDrawerProps {
    opened: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

/**
 * The panel opened from a list (an order, an attendee): the platform's popup, centered with its
 * round close button, a sheet from the bottom on phones.
 */
export const SideDrawer = ({opened, onClose, children}: SideDrawerProps) => {
    const isMobile = useMediaQuery('(max-width: 767px)');

    const body = (
        <>
            <UnstyledButton className={classes.close} onClick={onClose} aria-label={t`Close`}>
                <IconX size={20} stroke={2}/>
            </UnstyledButton>
            {/* Opening focus lands here rather than on the close button (no ring right away). */}
            <div data-autofocus tabIndex={-1} className={classes.focusStart}/>
            {children}
        </>
    );

    if (isMobile) {
        return (
            <Drawer
                opened={opened}
                onClose={onClose}
                position="bottom"
                size="auto"
                withCloseButton={false}
                classNames={{content: classes.sheet, body: classes.sheetBody}}
            >
                {body}
            </Drawer>
        );
    }

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            centered
            size={760}
            radius={32}
            withCloseButton={false}
            classNames={{content: classes.popup, body: classes.popupBody}}
        >
            {body}
        </Modal>
    );
}
