import {ReactNode, useState} from 'react';
import {IconCopyPlus, IconPencil, IconSend, IconTrash} from "@tabler/icons-react";
import {ActionIcon, Menu} from "@mantine/core";
import {useDisclosure} from "@mantine/hooks";
import {t, Trans} from "@lingui/macro";
import {useSortable} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {Event, IdParam, MessageType, Product, ProductPrice, ProductPriceType, ProductType} from "../../../types.ts";
import {formatDateWithLocale} from "../../../utilites/dates.ts";
import {intlLocale} from "../../../utilites/intlLocale.ts";
import {useDeleteProduct} from "../../../mutations/useDeleteProduct.ts";
import {showError, showSuccess} from "../../../utilites/notifications.tsx";
import {EditProductModal} from "../../modals/EditProductModal";
import {SendMessageModal} from "../../modals/SendMessageModal";
import {DuplicateProductModal} from "../../modals/DuplicateProductModal";
import {StatusTag, StatusTone} from "../StatusTag";
import classes from "./ProductsTable.module.scss";

const ICONS = '/interface/admin/produits';

// « 35 $ », « 12,50 $ »: no cents when there are none, as in the Figma rows.
const shortPrice = (amount: number, currency: string) => new Intl.NumberFormat(intlLocale(), {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
}).format(amount);

export const priceLabel = (product: Product, currency: string): string => {
    const prices = (product.prices || []).map((price) => Number(price.price));
    if (prices.length === 0) {
        return t`Price not set`;
    }
    const lowest = Math.min(...prices);
    const highest = Math.max(...prices);
    if (highest <= 0) {
        return t`Free`;
    }
    return lowest === highest || product.type !== ProductPriceType.Tiered
        ? shortPrice(product.type === ProductPriceType.Tiered ? lowest : prices[0], currency)
        : `${shortPrice(lowest, currency)} – ${shortPrice(highest, currency)}`;
};

export const productStatus = (product: Product): { label: string, tone: StatusTone, onSale: boolean } => {
    // An ended sale says so even when it sold out (« Prévente · Terminé » in Figma).
    if (product.is_after_sale_end_date) {
        return {label: t`Ended`, tone: 'neutral', onSale: false};
    }
    if (product.is_sold_out) {
        return {label: t`Sold Out`, tone: 'problem', onSale: false};
    }
    if (product.is_before_sale_start_date) {
        return {label: t`Scheduled`, tone: 'waiting', onSale: false};
    }
    if (product.is_hidden) {
        return {label: t`Hidden`, tone: 'neutral', onSale: false};
    }
    return product.is_available === false
        ? {label: t`Paused`, tone: 'waiting', onSale: false}
        : {label: t`On Sale`, tone: 'ok', onSale: true};
};

// « Jusqu'au 6 nov. », « Terminée le 15 oct. », « À partir du 1 déc. »: the sale period in one line.
const salePeriod = (product: Product, timezone: string): string | null => {
    const day = (date?: string) => date ? formatDateWithLocale(date, 'chartDate', timezone) : '';
    const start = day(product.sale_start_date as string | undefined);
    const end = day(product.sale_end_date as string | undefined);

    if (product.is_before_sale_start_date && start) {
        return t`From ${start}`;
    }
    if (product.is_after_sale_end_date && end) {
        return t`Ended on ${end}`;
    }
    return end ? t`Until ${end}` : null;
};

const sales = (product: Product) => {
    const sold = Number(product.quantity_sold) || 0;
    const total = Number(product.initial_quantity_available) || 0;

    return {sold, total, percentage: total > 0 ? Math.min(sold / total * 100, 100) : 0};
};

// « XS 4 · S 12 · M 9 » for a product with sizes, « 22 en stock » otherwise.
const stockLine = (product: Product): string => {
    const prices = product.prices || [];
    const remaining = (price: ProductPrice) => price.initial_quantity_available == null
        ? null
        : Math.max(price.initial_quantity_available - (price.quantity_sold || 0), 0);

    if (prices.length > 1 && prices.every((price) => price.label)) {
        return prices
            .map((price) => {
                const left = remaining(price);
                return left === null ? String(price.label) : `${price.label} ${left}`;
            })
            .join(' · ');
    }

    const left = prices.length === 1 ? remaining(prices[0]) : null;
    return left === null ? t`Unlimited stock` : t`${left} in stock`;
};

interface ProductRowProps {
    id: string;
    product: Product;
    event: Event;
    draggable: boolean;
}

/**
 * A ticket or a product of Figma « Admin · Événement · Billets et produits » (542:2074, phone 542:2720):
 * grip, round icon, name and details, sales, price, status and « … ». A click on the name edits it.
 */
export const ProductRow = ({id, product, event, draggable}: ProductRowProps) => {
    const {attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging}
        = useSortable({id, disabled: !draggable});
    const [isEditModalOpen, editModal] = useDisclosure(false);
    const [isDuplicateModalOpen, duplicateModal] = useDisclosure(false);
    const [isMessageModalOpen, messageModal] = useDisclosure(false);
    const [productId, setProductId] = useState<IdParam>();
    const deleteMutation = useDeleteProduct();

    const isTicket = product.product_type === ProductType.Ticket;
    const status = productStatus(product);
    const price = priceLabel(product, event.currency);
    const period = salePeriod(product, event.timezone);
    const {sold, total, percentage} = sales(product);
    const soldLabel = total > 0 ? t`${sold} / ${total} sold` : t`${sold} sold`;
    const hasSizes = product.type === ProductPriceType.Sized;

    const open = (modal: { open: () => void }) => {
        setProductId(product.id);
        modal.open();
    };

    const remove = () => {
        deleteMutation.mutate({productId: product.id, eventId: product.event_id}, {
            onSuccess: () => showSuccess(t`Product deleted successfully`),
            onError: (error: any) => {
                if (error.response?.status === 409) {
                    showError(error.response.data.message
                        || t`This product cannot be deleted because it is associated with an order. You can hide it instead.`);
                }
            },
        });
    };

    const tag = (children: ReactNode) => <span className={classes.typeTag}>{children}</span>;

    return (
        <>
            <article
                ref={setNodeRef}
                className={classes.row}
                data-kind={isTicket ? 'ticket' : 'product'}
                data-dragging={isDragging || undefined}
                style={{transform: CSS.Transform.toString(transform), transition}}
            >
                {draggable && (
                    <button type="button" ref={setActivatorNodeRef} className={classes.grip}
                            aria-label={t`Drag to reorder`} {...attributes} {...listeners}>
                        <img src={`${ICONS}/grip.svg`} width={18} height={18} alt=""/>
                    </button>
                )}

                <span className={classes.pastille} data-kind={isTicket ? 'ticket' : 'product'} aria-hidden>
                    <img src={`${ICONS}/${isTicket ? 'billet' : hasSizes ? 'chandail' : 'sac'}.svg`}
                         width={20} height={20} alt=""/>
                </span>

                <div className={classes.main}>
                    <div className={classes.titleLine}>
                        <button type="button" className={classes.title} onClick={() => open(editModal)}>
                            {product.title}
                        </button>
                        {product.is_hidden_without_promo_code && tag(t`With a promo code`)}
                        {product.type === ProductPriceType.Donation && tag(t`Donation`)}
                    </div>

                    {isTicket ? (
                        <>
                            {period && <span className={`${classes.detail} ${classes.desktopOnly}`}>{period}</span>}
                            <span className={`${classes.detail} ${classes.phoneOnly}`}>{`${price} · ${soldLabel}`}</span>
                        </>
                    ) : (
                        <>
                            <span className={classes.detail}>{t`Sold on its own as an extra`}</span>
                            <span className={classes.stock}>
                                <img src={`${ICONS}/sac-13.svg`} width={13} height={13} alt=""/>
                                {stockLine(product)}
                            </span>
                        </>
                    )}
                </div>

                {isTicket && (
                    <div className={`${classes.sales} ${classes.desktopOnly}`}>
                        <span>{soldLabel}</span>
                        {total > 0 && (
                            <span className={classes.progress} data-ended={!status.onSale || undefined}
                                  role="progressbar" aria-label={soldLabel} aria-valuemin={0} aria-valuemax={100}
                                  aria-valuenow={Math.round(percentage)}>
                                <span style={{width: `${percentage}%`}}/>
                            </span>
                        )}
                    </div>
                )}

                {!isTicket && !status.onSale && <StatusTag tone={status.tone}>{status.label}</StatusTag>}

                <span className={`${classes.price} ${isTicket ? classes.desktopOnly : ''}`}>{price}</span>

                {isTicket && (
                    <span className={classes.status}>
                        <StatusTag tone={status.tone}>{status.label}</StatusTag>
                    </span>
                )}

                <Menu shadow="md" width={240} position="bottom-end">
                    <Menu.Target>
                        <ActionIcon className={classes.more} variant="subtle" aria-label={t`Manage`}>
                            <img src={`${ICONS}/actions.svg`} width={20} height={20} alt=""/>
                        </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Item onClick={() => open(editModal)} leftSection={<IconPencil size={14}/>}>
                            <Trans>Edit {isTicket ? t`Ticket` : t`Product`}</Trans>
                        </Menu.Item>
                        {isTicket && (
                            <Menu.Item onClick={() => open(messageModal)} leftSection={<IconSend size={14}/>}>
                                {t`Message Attendees`}
                            </Menu.Item>
                        )}
                        <Menu.Item onClick={() => open(duplicateModal)} leftSection={<IconCopyPlus size={14}/>}>
                            {t`Duplicate`}
                        </Menu.Item>
                        <Menu.Divider/>
                        <Menu.Item onClick={remove} color="red" leftSection={<IconTrash size={14}/>}>
                            {t`Delete`}
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            </article>

            {isDuplicateModalOpen && <DuplicateProductModal originalProductId={productId} onClose={duplicateModal.close}/>}
            {isEditModalOpen && <EditProductModal productId={productId} onClose={editModal.close}/>}
            {isMessageModalOpen && (
                <SendMessageModal onClose={messageModal.close} productId={productId}
                                  messageType={MessageType.TicketHolders}/>
            )}
        </>
    );
};
