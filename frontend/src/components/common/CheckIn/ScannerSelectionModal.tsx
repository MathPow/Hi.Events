import {Modal, UnstyledButton} from "@mantine/core";
import {IconCamera, IconScan} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import {showSuccess} from "../../../utilites/notifications.tsx";
import classes from "../../layouts/CheckIn/CheckIn.module.scss";

interface ScannerSelectionModalProps {
    isOpen: boolean;
    isHidScannerActive: boolean;
    onClose: () => void;
    onCameraSelect: () => void;
    onHidScannerSelect: () => void;
}

// « Scanner »: the phone's camera or a USB scanner, as two big choices.
export const ScannerSelectionModal = ({
    isOpen,
    isHidScannerActive,
    onClose,
    onCameraSelect,
    onHidScannerSelect
}: ScannerSelectionModalProps) => {
    return (
        <Modal
            opened={isOpen}
            onClose={onClose}
            title={t`Select Scanner Type`}
            size="sm"
            radius="xl"
            classNames={{title: classes.modalTitle}}
        >
            <div className={classes.scannerChoices}>
                <UnstyledButton className={classes.scannerChoice} onClick={onCameraSelect}>
                    <span className={classes.scannerChoiceIcon}><IconCamera size={22}/></span>
                    {t`Camera Scanner`}
                </UnstyledButton>
                <UnstyledButton
                    className={classes.scannerChoice}
                    disabled={isHidScannerActive}
                    onClick={() => {
                        onHidScannerSelect();
                        if (!isHidScannerActive) {
                            showSuccess(t`USB Scanner mode activated. Start scanning tickets now.`);
                        }
                    }}
                >
                    <span className={classes.scannerChoiceIcon}><IconScan size={22}/></span>
                    {isHidScannerActive ? t`USB Scanner Already Active` : t`USB/HID Scanner`}
                </UnstyledButton>
            </div>
        </Modal>
    );
};
