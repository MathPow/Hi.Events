import {Alert, Button, Checkbox, Modal, NumberInput, Select, Stack, Text, TextInput} from "@mantine/core";
import {useForm} from "@mantine/form";
import {IconAlertCircle, IconShoppingCart} from "@tabler/icons-react";
import {t, Trans} from "@lingui/macro";
import {useEffect, useMemo} from "react";
import {DoorSaleProduct, IdParam} from "../../../types.ts";
import {useGetDoorSaleProductsPublic} from "../../../queries/useGetDoorSaleProductsPublic.ts";
import {useCreateDoorSalePublic} from "../../../mutations/useCreateDoorSalePublic.ts";
import {showError, showSuccess} from "../../../utilites/notifications.tsx";
import {useFormErrorResponseHandler} from "../../../hooks/useFormErrorResponseHandler.tsx";
import {formatCurrency} from "../../../utilites/currency.ts";

interface DoorSaleModalProps {
    isOpen: boolean;
    checkInListShortId: IdParam;
    currency: string;
    onClose: () => void;
}

interface DoorSaleFormValues {
    priceKey: string | null;
    quantity: number;
    first_name: string;
    last_name: string;
    email: string;
    check_in_immediately: boolean;
}

/**
 * Sells a remaining ticket at the door. The money is taken on whatever terminal the organizer
 * already uses - this only records the ticket and, by default, lets the buyer straight in.
 */
export const DoorSaleModal = ({isOpen, checkInListShortId, currency, onClose}: DoorSaleModalProps) => {
    const productsQuery = useGetDoorSaleProductsPublic(checkInListShortId, isOpen);
    const products = productsQuery.data?.data;
    const doorSaleMutation = useCreateDoorSalePublic();
    const errorHandler = useFormErrorResponseHandler();

    const form = useForm<DoorSaleFormValues>({
        initialValues: {
            priceKey: null,
            quantity: 1,
            first_name: '',
            last_name: '',
            email: '',
            check_in_immediately: true,
        },
    });

    // One option per price, because a product can carry several tiers and the door picks one.
    const options = useMemo(() => (products ?? []).flatMap((product: DoorSaleProduct) =>
        product.prices.map((price) => ({
            value: `${product.id}:${price.id}`,
            label: [
                price.label ? `${product.title} - ${price.label}` : product.title,
                formatCurrency(price.price, currency),
            ].join(' · '),
            remaining: price.quantity_remaining,
            disabled: price.quantity_remaining === 0,
        }))
    ), [products, currency]);

    useEffect(() => {
        if (isOpen && !form.values.priceKey && options.length > 0) {
            form.setFieldValue('priceKey', options.find(option => !option.disabled)?.value ?? null);
        }
    }, [isOpen, options]);

    const selected = options.find(option => option.value === form.values.priceKey);

    const handleSubmit = (values: DoorSaleFormValues) => {
        if (!values.priceKey) {
            return;
        }

        const [productId, productPriceId] = values.priceKey.split(':');

        doorSaleMutation.mutate({
            checkInListShortId,
            doorSale: {
                product_id: Number(productId),
                product_price_id: Number(productPriceId),
                quantity: values.quantity,
                first_name: values.first_name,
                last_name: values.last_name || undefined,
                email: values.email || undefined,
                check_in_immediately: values.check_in_immediately,
            },
        }, {
            onSuccess: () => {
                showSuccess(values.check_in_immediately
                    ? t`Ticket sold and checked in`
                    : t`Ticket sold`);
                form.reset();
                onClose();
            },
            onError: (error: any) => {
                const message = error?.response?.data?.message;

                if (message) {
                    showError(message);
                    return;
                }

                errorHandler(form, error);
            },
        });
    };

    return (
        <Modal
            opened={isOpen}
            onClose={onClose}
            title={t`Sell a ticket at the door`}
            size="md"
        >
            <form onSubmit={form.onSubmit(handleSubmit)}>
                <Stack>
                    {productsQuery.isError && (
                        <Alert icon={<IconAlertCircle size={20}/>} color="red" variant="light">
                            {t`Tickets cannot be sold from this check-in list.`}
                        </Alert>
                    )}

                    {options.length === 0 && !productsQuery.isLoading && !productsQuery.isError && (
                        <Alert icon={<IconAlertCircle size={20}/>} color="orange" variant="light">
                            {t`There is nothing left to sell on this list.`}
                        </Alert>
                    )}

                    <Select
                        required
                        label={t`Ticket`}
                        placeholder={t`Select a ticket`}
                        data={options}
                        disabled={productsQuery.isLoading}
                        {...form.getInputProps('priceKey')}
                    />

                    {selected?.remaining !== null && selected?.remaining !== undefined && (
                        <Text size="sm" c="dimmed">
                            <Trans>{selected.remaining} left</Trans>
                        </Text>
                    )}

                    <NumberInput
                        required
                        min={1}
                        max={10}
                        label={t`How many?`}
                        {...form.getInputProps('quantity')}
                    />

                    <TextInput
                        required
                        label={t`First name`}
                        placeholder={t`Alex`}
                        {...form.getInputProps('first_name')}
                    />

                    <TextInput
                        label={t`Last name`}
                        {...form.getInputProps('last_name')}
                    />

                    <TextInput
                        type="email"
                        label={t`Email`}
                        description={t`Optional. If given, the ticket and its QR code are emailed to the buyer.`}
                        {...form.getInputProps('email')}
                    />

                    <Checkbox
                        label={t`Check in immediately`}
                        {...form.getInputProps('check_in_immediately', {type: 'checkbox'})}
                    />

                    <Button
                        type="submit"
                        fullWidth
                        leftSection={<IconShoppingCart size={20}/>}
                        loading={doorSaleMutation.isPending}
                        disabled={!form.values.priceKey}
                    >
                        {t`Sell`}
                    </Button>
                </Stack>
            </form>
        </Modal>
    );
};
