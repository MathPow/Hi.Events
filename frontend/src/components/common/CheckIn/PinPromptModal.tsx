import {Alert, Button, Modal, Stack, Text, TextInput} from "@mantine/core";
import {IconLock} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import {useEffect, useState} from "react";

interface PinPromptModalProps {
    isOpen: boolean;
    checkInListName?: string;
    hasFailed: boolean;
    onSubmit: (pin: string) => void;
}

/**
 * The check-in link alone is enough to reach the attendee list, so a list that sets a door code
 * asks for it before showing anything.
 */
export const PinPromptModal = ({isOpen, checkInListName, hasFailed, onSubmit}: PinPromptModalProps) => {
    const [pin, setPin] = useState('');

    useEffect(() => {
        if (hasFailed) {
            setPin('');
        }
    }, [hasFailed]);

    const submit = () => {
        if (pin.length >= 4) {
            onSubmit(pin);
        }
    };

    return (
        <Modal
            opened={isOpen}
            onClose={() => undefined}
            withCloseButton={false}
            closeOnClickOutside={false}
            closeOnEscape={false}
            title={checkInListName ?? t`Check-in`}
            size="sm"
            centered
        >
            <Stack>
                <Text size="sm" c="dimmed">
                    {t`Enter the PIN the organizer gave you to open this check-in list.`}
                </Text>

                {hasFailed && (
                    <Alert icon={<IconLock size={20}/>} color="red" variant="light">
                        {t`That PIN is not correct.`}
                    </Alert>
                )}

                <TextInput
                    inputMode="numeric"
                    autoFocus
                    size="xl"
                    ta="center"
                    maxLength={12}
                    value={pin}
                    aria-label={t`Check-in PIN`}
                    onChange={(event) => setPin(event.currentTarget.value.replace(/\D/g, ''))}
                    onKeyDown={(event) => event.key === 'Enter' && submit()}
                />

                <Button fullWidth disabled={pin.length < 4} onClick={submit}>
                    {t`Unlock`}
                </Button>
            </Stack>
        </Modal>
    );
};
