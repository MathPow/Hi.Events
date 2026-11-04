import {Button, UnstyledButton} from "@mantine/core";
import {IconCheck, IconTrash} from "@tabler/icons-react";
import {GenericModalProps, IdParam, Product, ProductPriceType, ProductType} from "../../../types.ts";
import {useForm} from "@mantine/form";
import {useParams} from "react-router";
import {useEffect, useRef, useState} from "react";
import {ProductForm} from "../../forms/ProductForm";
import {DehorsPopup} from "../../common/DehorsPopup";
import formClasses from "../../forms/ProductForm/ProductForm.module.scss";
import {useDeleteProduct} from "../../../mutations/useDeleteProduct.ts";
import {confirmationDialog} from "../../../utilites/confirmationDialog.tsx";
import {useUpdateProduct} from "../../../mutations/useUpdateProduct.ts";
import {showError, showSuccess} from "../../../utilites/notifications.tsx";
import {useFormErrorResponseHandler} from "../../../hooks/useFormErrorResponseHandler.tsx";
import {t} from "@lingui/macro";
import {useGetProduct} from "../../../queries/useGetProduct.ts";
import {utcToTz} from "../../../utilites/dates.ts";
import {useGetEvent} from "../../../queries/useGetEvent.ts";

export const EditProductModal = ({onClose, productId}: GenericModalProps & { productId: IdParam }) => {
    const {eventId} = useParams();
    const {data: product} = useGetProduct(eventId, productId);
    const {data: event} = useGetEvent(eventId);
    const errorHandler = useFormErrorResponseHandler();
    const form = useForm<Product>({
        initialValues: {
            title: '',
            description: '',
            max_per_order: 100,
            min_per_order: 1,
            sale_start_date: undefined,
            sale_end_date: undefined,
            hide_before_sale_start_date: undefined,
            hide_after_sale_end_date: undefined,
            start_collapsed: undefined,
            show_quantity_remaining: undefined,
            hide_when_sold_out: undefined,
            is_hidden_without_promo_code: undefined,
            is_highlighted: false,
            highlight_message: undefined,
            waitlist_enabled: null,
            type: ProductPriceType.Paid,
            tax_and_fee_ids: [],
            prices: [],
            product_type: ProductType.Ticket,
            product_category_id: undefined,
        },
    });

    const mutation = useUpdateProduct();
    const deleteMutation = useDeleteProduct();
    const loaded = useRef(false);
    const saved = useRef<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');

    // The form starts from the saved product once: refetches after a save don't overwrite what is being typed.
    useEffect(() => {
        if (!product || !event || loaded.current) {
            return;
        }
        loaded.current = true;

        form.setValues({
            id: product.id,
            title: product.title,
            description: product.description,
            max_per_order: product.max_per_order ?? 0,
            min_per_order: product.min_per_order ?? 0,
            sale_start_date: utcToTz(product.sale_start_date, event.timezone),
            sale_end_date: utcToTz(product.sale_end_date, event.timezone),
            hide_before_sale_start_date: product.hide_before_sale_start_date,
            hide_after_sale_end_date: product.hide_after_sale_end_date,
            show_quantity_remaining: product.show_quantity_remaining,
            start_collapsed: product.start_collapsed,
            hide_when_sold_out: product.hide_when_sold_out,
            is_hidden_without_promo_code: product.is_hidden_without_promo_code,
            type: product.type,
            tax_and_fee_ids: product.taxes_and_fees?.map(t => String(t.id)) ?? [],
            is_hidden: product.is_hidden,
            is_highlighted: product.is_highlighted,
            highlight_message: product.highlight_message,
            waitlist_enabled: product.waitlist_enabled ?? null,
            charity_amount: product.charity_amount ?? null,
            deposit_amount: product.deposit_amount ?? null,
            option_heading: product.option_heading ?? null,
            product_type: product.product_type,
            product_category_id: String(product.product_category_id),
            prices: product.prices?.map(p => ({
                price: p.price ?? 0,
                label: p.label,
                sale_start_date: utcToTz(p.sale_start_date, event.timezone),
                sale_end_date: utcToTz(p.sale_end_date, event.timezone),
                initial_quantity_available: p.initial_quantity_available ?? undefined,
                id: p.id,
                is_hidden: p.is_hidden,
            })) ?? [],
        });
    }, [product, event]);

    const save = async (values: Product, quiet: boolean) => {
        const snapshot = JSON.stringify(values);
        setStatus('saving');
        try {
            await mutation.mutateAsync({productData: values, eventId: eventId, productId: productId});
            saved.current = snapshot;
            form.clearErrors();
            setStatus('saved');
            return true;
        } catch (error: any) {
            setStatus('failed');
            if (quiet) {
                form.setErrors(error?.response?.data?.errors ?? {});
            } else {
                errorHandler(form, error);
            }
            return false;
        }
    };

    // « Enregistrement automatique »: a moment after the last change. New price options wait for
    // « Terminé », since they only get their id from the server once saved.
    useEffect(() => {
        if (form.values.id === undefined) {
            return;
        }
        const snapshot = JSON.stringify(form.values);
        if (saved.current === null) {
            saved.current = snapshot;
            return;
        }
        if (snapshot === saved.current || !form.values.prices?.every(price => price.id)) {
            return;
        }
        const timer = window.setTimeout(() => save(form.values, true), 900);
        return () => window.clearTimeout(timer);
    }, [form.values]);

    // « Terminé » and the X: what is left to save first, and stay open if it is refused.
    const finish = async () => {
        if (mutation.isPending) {
            return;
        }
        const isDirty = saved.current !== null && JSON.stringify(form.values) !== saved.current;
        if (!isDirty || await save(form.values, false)) {
            onClose();
        }
    };

    const remove = () => confirmationDialog(
        t`Are you sure you want to delete this product? This cannot be undone.`,
        () => deleteMutation.mutate({productId, eventId}, {
            onSuccess: () => {
                showSuccess(t`Product deleted successfully`);
                onClose();
            },
            onError: (error: any) => showError(
                error?.response?.data?.message
                || t`This product cannot be deleted because it is associated with an order. You can hide it instead.`,
            ),
        }),
    );

    const statusLine = status === 'idle' ? null : (
        <span className={formClasses.saveStatus} data-failed={status === 'failed' || undefined} role="status">
            {status === 'saved' && <IconCheck size={16} stroke={2.5}/>}
            {status === 'saving' && t`Saving...`}
            {status === 'saved' && t`Changes saved`}
            {status === 'failed' && t`Not saved: check the fields in red.`}
        </span>
    );

    const isTicket = form.values.product_type === ProductType.Ticket;

    return (
        <DehorsPopup onClose={finish} title={isTicket ? t`Edit the ticket` : t`Edit the product`} status={statusLine}>
            <form onSubmit={(submitEvent) => {
                submitEvent.preventDefault();
                finish();
            }} className={formClasses.form}>
                {product && <ProductForm product={product} form={form}/>}
                <div className={formClasses.actions}>
                    <UnstyledButton className={formClasses.deleteButton} onClick={remove}>
                        <IconTrash size={18} stroke={2}/>
                        {t`Delete`}
                    </UnstyledButton>
                    <Button type="submit" className={formClasses.doneButton} loading={mutation.isPending}>
                        {t`Done`}
                    </Button>
                </div>
            </form>
        </DehorsPopup>
    )
};
