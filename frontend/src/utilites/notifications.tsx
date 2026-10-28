import {notifications} from "@mantine/notifications";
import {IconCheck, IconInfoSmall, IconX} from "@tabler/icons-react";
import React, {ReactNode} from "react";

export const showSuccess = (message: ReactNode, icon: ReactNode = <IconCheck/>) => {
    notifications.show({
        message: message,
        color: 'green',
        icon: icon,
        position: 'top-center',
    })
}

export const showInfo = (message: ReactNode, icon: ReactNode = <IconInfoSmall/>) => {
    notifications.show({
        message: message,
        color: 'blue',
        icon: icon,
        position: 'top-center',
    })
}

// autoClose: false garde l'erreur ouverte, quand elle porte un bouton.
export const showError = (message: React.ReactNode, icon: ReactNode = <IconX/>, autoClose?: number | false) => {
    notifications.show({
        message: message,
        color: 'red',
        icon: icon,
        position: 'top-center',
        autoClose: autoClose,
    })
}
