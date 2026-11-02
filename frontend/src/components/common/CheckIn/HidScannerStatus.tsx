import {Button} from "@mantine/core";
import {IconScan, IconX} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import {showSuccess} from "../../../utilites/notifications.tsx";
import classes from "../../layouts/CheckIn/CheckIn.module.scss";

interface HidScannerStatusProps {
    isActive: boolean;
    pageHasFocus: boolean;
    onDisable: () => void;
}

// The USB scanner banner: green while it listens, yellow once the page lost the focus.
export const HidScannerStatus = ({
    isActive,
    pageHasFocus,
    onDisable
}: HidScannerStatusProps) => {
    if (!isActive) return null;

    return (
        <div className={classes.scannerStatus} data-tone={pageHasFocus ? 'ok' : 'waiting'} role="status">
            <IconScan size={20} className={classes.scannerStatusIcon}/>
            <span className={classes.scannerStatusText}>
                {pageHasFocus
                    ? t`USB scanner on: scan a ticket.`
                    : t`USB scanner paused: click anywhere on the page to resume.`}
            </span>
            <Button
                className={classes.scannerStatusButton}
                leftSection={<IconX size={16}/>}
                onClick={() => {
                    onDisable();
                    showSuccess(t`USB Scanner mode deactivated`);
                }}
            >
                {t({message: 'Turn off', context: 'usb scanner'})}
            </Button>
        </div>
    );
};
