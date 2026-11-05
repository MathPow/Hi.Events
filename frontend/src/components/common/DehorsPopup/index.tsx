import {ReactNode} from "react";
import {Drawer, Modal, UnstyledButton} from "@mantine/core";
import {useMediaQuery} from "@mantine/hooks";
import {t} from "@lingui/macro";
import {IconX} from "@tabler/icons-react";
import classes from "../../modals/CreateEventModal/CreateEventModal.module.scss";

interface DehorsPopupProps {
    onClose: () => void;
    title: ReactNode;
    // Under the title (« Changements enregistrés »).
    status?: ReactNode;
    size?: number;
    children: ReactNode;
}

/**
 * The popup's header on its own, for a popup that renders its own body inside a plain Modal:
 * the FatFrank title, an optional line under it, the round close button.
 */
export const PopupHeader = ({title, status, onClose}: { title: ReactNode, status?: ReactNode, onClose: () => void }) => (
    <div className={classes.popupHeader}>
        <div className={classes.popupHeading}>
            <h2 className={classes.popupTitle}>{title}</h2>
            {status}
        </div>
        <UnstyledButton className={classes.close} onClick={onClose} aria-label={t`Close`}>
            <IconX size={20} stroke={2}/>
        </UnstyledButton>
    </div>
);

/**
 * The platform's popup (Figma « Créer un événement »): centered with its title and round close button,
 * a sheet from the bottom on phones.
 */
export const DehorsPopup = ({onClose, title, status, size = 640, children}: DehorsPopupProps) => {
    const isMobile = useMediaQuery('(max-width: 767px)');

    if (isMobile) {
        return (
            <Drawer
                opened
                onClose={onClose}
                position="bottom"
                size="auto"
                title={title}
                classNames={{
                    content: classes.sheet,
                    header: classes.sheetHeader,
                    title: classes.sheetTitle,
                    close: classes.sheetClose,
                    body: classes.sheetBody,
                }}
            >
                {status}
                {children}
            </Drawer>
        );
    }

    return (
        <Modal
            opened
            onClose={onClose}
            centered
            size={size}
            radius={32}
            withCloseButton={false}
            classNames={{content: classes.popup, body: classes.popupBody}}
        >
            <PopupHeader title={title} status={status} onClose={onClose}/>
            {children}
        </Modal>
    );
};
