import {Modal as MantineModal, ModalProps as MantineModalProps} from "@mantine/core";
import React from "react";

interface ModalProps {
    heading?: string | React.ReactNode,
    modalHeader?: 'default' | 'branded',
}

export const Modal = (props: MantineModalProps & ModalProps) => {
    // Every popup has the same header now: « branded » is kept so callers don't change.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { modalHeader, ...restProps } = props;
    return (
        <MantineModal
            {...restProps}
            size={'xl'}
            withCloseButton={restProps.withCloseButton ?? true}
            title={props.heading}
            classNames={props.classNames}
        >
            {props.children}
        </MantineModal>
    )
}
