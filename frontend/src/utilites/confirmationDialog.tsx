import {modals} from "@mantine/modals";
import {t} from "@lingui/macro";

// The two answers of a confirmation, half and half on one line.
export const CONFIRM_GROUP_PROPS = {grow: true, wrap: 'nowrap'} as const;

interface ConfirmationDialogOptions {
    confirm?: string;
    cancel?: string;
    useCheckoutColors?: boolean;
}

export const confirmationDialog = (
    message: string,
    onConfirm: () => void,
    options?: ConfirmationDialogOptions,
) => {
    const labels = {
        confirm: options?.confirm || t`Confirm`,
        cancel: options?.cancel || t`Cancel`,
    };

    const checkoutStyles = options?.useCheckoutColors ? {
        header: {
            backgroundColor: 'var(--checkout-surface, #FFFFFF)',
        },
        title: {
            color: 'var(--checkout-text-primary, #1a1a1a)',
        },
        content: {
            backgroundColor: 'var(--checkout-surface, #FFFFFF)',
        },
        body: {
            color: 'var(--checkout-text-primary, #1a1a1a)',
        },
    } : undefined;

    modals.openConfirmModal({
        title: message,
        labels,
        groupProps: CONFIRM_GROUP_PROPS,
        styles: checkoutStyles,
        onConfirm: () => onConfirm(),
    });
}