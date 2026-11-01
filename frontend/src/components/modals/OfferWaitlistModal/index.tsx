import {EventSettings, GenericModalProps, IdParam, WaitlistProductStats, WaitlistStats} from "../../../types.ts";
import {Modal} from "../../common/Modal";
import {useOfferWaitlistEntry} from "../../../mutations/useOfferWaitlistEntry.ts";
import {showError, showSuccess} from "../../../utilites/notifications.tsx";
import {t} from "@lingui/macro";
import {Anchor, Badge, NumberInput, Table, Text} from "@mantine/core";
import {IconBolt, IconSend} from "@tabler/icons-react";
import {NavLink} from "react-router";
import {Button} from "../../common/Button";
import {useState} from "react";
import classes from "./OfferWaitlistModal.module.scss";

interface OfferWaitlistModalProps extends GenericModalProps {
    eventId: IdParam;
    eventSettings?: EventSettings;
    stats?: WaitlistStats;
}

const getDefaultQuantity = (product: WaitlistProductStats): number => {
    if (product.available === 0) return 0;
    if (product.available === null) return product.waiting;
    return Math.min(product.waiting, product.available);
};

const getMaxQuantity = (product: WaitlistProductStats): number => {
    if (product.available === null) return product.waiting;
    return Math.min(product.waiting, product.available);
};

export const OfferWaitlistModal = ({onClose, eventId, eventSettings, stats}: OfferWaitlistModalProps) => {
    const mutation = useOfferWaitlistEntry();
    const [loadingProductId, setLoadingProductId] = useState<number | null>(null);

    const productsWithWaiting = stats?.products?.filter(p => p.waiting > 0) ?? [];
    const isAutoProcess = !!eventSettings?.waitlist_auto_process;

    const [quantities, setQuantities] = useState<Record<number, number>>(() => {
        const initial: Record<number, number> = {};
        productsWithWaiting.forEach(p => {
            initial[p.product_price_id] = getDefaultQuantity(p);
        });
        return initial;
    });

    const timeoutHours = eventSettings?.waitlist_offer_timeout_minutes
        ? Math.round(eventSettings.waitlist_offer_timeout_minutes / 60 * 10) / 10
        : null;

    const handleOffer = (product: WaitlistProductStats) => {
        const qty = quantities[product.product_price_id] ?? 1;
        setLoadingProductId(product.product_price_id);

        mutation.mutate({
            eventId,
            productPriceId: product.product_price_id,
            quantity: qty,
        }, {
            onSuccess: (response) => {
                const count = response?.data?.length ?? qty;
                showSuccess(
                    count === 1
                        ? t`Successfully offered tickets to 1 person`
                        : t`Successfully offered tickets to ${count} people`
                );
                setLoadingProductId(null);
            },
            onError: (error: any) => {
                const message = error?.response?.data?.message || t`Failed to offer tickets`;
                showError(message);
                setLoadingProductId(null);
            },
        });
    };

    const isBusy = loadingProductId !== null;

    if (isAutoProcess) {
        return (
            <Modal
                opened
                onClose={onClose}
                heading={t`Offer Tickets`}
            >
                <div className={classes.auto}>
                    <span className={classes.pastille} aria-hidden><IconBolt size={24} stroke={2}/></span>
                    <strong className={classes.autoTitle}>{t`Auto-offer is enabled`}</strong>
                    <p className={classes.autoText}>
                        {t`Tickets are automatically offered to waitlisted customers when capacity becomes available.`}
                        {!!timeoutHours && ' ' + t`Offers expire after ${timeoutHours} hours.`}
                    </p>
                    <Anchor
                        component={NavLink}
                        to={`/manage/event/${eventId}/settings/registration#waitlist-settings`}
                        className={classes.settingsLink}
                    >
                        {t`Change waitlist settings`}
                    </Anchor>
                </div>

                {productsWithWaiting.length > 0 && (
                    <>
                        <h3 className={classes.sectionTitle}>{t`Manual offer`}</h3>
                        <p className={classes.sectionText}>
                            {t`You can still manually offer tickets if needed.`}
                        </p>
                        <ProductOfferTable
                            products={productsWithWaiting}
                            quantities={quantities}
                            setQuantities={setQuantities}
                            onOffer={handleOffer}
                            loadingProductId={loadingProductId}
                            isBusy={isBusy}
                        />
                    </>
                )}
            </Modal>
        );
    }

    return (
        <Modal
            opened
            onClose={onClose}
            heading={t`Offer Tickets`}
        >
            <p className={classes.sectionText}>
                {t`Each person will receive an email with a reserved spot to complete their purchase.`}
                {!!timeoutHours && ' ' + t`Offers expire after ${timeoutHours} hours.`}
            </p>

            {productsWithWaiting.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">{t`No products have waiting entries`}</Text>
            ) : (
                <ProductOfferTable
                    products={productsWithWaiting}
                    quantities={quantities}
                    setQuantities={setQuantities}
                    onOffer={handleOffer}
                    loadingProductId={loadingProductId}
                    isBusy={isBusy}
                />
            )}
        </Modal>
    );
};

const ProductOfferTable = ({products, quantities, setQuantities, onOffer, loadingProductId, isBusy}: {
    products: WaitlistProductStats[];
    quantities: Record<number, number>;
    setQuantities: (fn: (prev: Record<number, number>) => Record<number, number>) => void;
    onOffer: (product: WaitlistProductStats) => void;
    loadingProductId: number | null;
    isBusy: boolean;
}) => (
    <div className={classes.tableCard}>
        <Table className={classes.table} verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
                <Table.Tr>
                    <Table.Th>{t`Product`}</Table.Th>
                    <Table.Th style={{textAlign: 'center'}}>{t`Waiting`}</Table.Th>
                    <Table.Th style={{textAlign: 'center'}}>{t`Available`}</Table.Th>
                    <Table.Th style={{textAlign: 'right'}}>{t`Qty`}</Table.Th>
                    <Table.Th style={{width: 1}}></Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {products.map(product => {
                    const noCapacity = product.available === 0;
                    const isRowLoading = loadingProductId === product.product_price_id;
                    const max = getMaxQuantity(product);

                    return (
                        <Table.Tr
                            key={product.product_price_id}
                            style={noCapacity ? {opacity: 0.5} : undefined}
                        >
                            <Table.Td>
                                <Text className={classes.productTitle}>{product.product_title}</Text>
                            </Table.Td>
                            <Table.Td style={{textAlign: 'center'}}>
                                {product.waiting}
                            </Table.Td>
                            <Table.Td style={{textAlign: 'center'}}>
                                {noCapacity ? (
                                    <Badge color="red" variant="light" size="sm">{t`No capacity`}</Badge>
                                ) : product.available === null ? (
                                    <Badge color="teal" variant="light" size="sm">{t`Unlimited`}</Badge>
                                ) : (
                                    product.available
                                )}
                            </Table.Td>
                            <Table.Td style={{textAlign: 'right'}}>
                                {!noCapacity && (
                                    <NumberInput
                                        size="xs"
                                        min={1}
                                        max={max}
                                        mb={0}
                                        value={quantities[product.product_price_id] ?? 1}
                                        onChange={(val) => setQuantities(prev => ({
                                            ...prev,
                                            [product.product_price_id]: Number(val) || 1,
                                        }))}
                                        disabled={isBusy}
                                        style={{width: 70, marginLeft: 'auto'}}
                                    />
                                )}
                            </Table.Td>
                            <Table.Td>
                                {!noCapacity && (
                                    <Button
                                        size="xs"
                                        className={classes.offerButton}
                                        leftSection={<IconSend size={14}/>}
                                        onClick={() => onOffer(product)}
                                        disabled={isBusy && !isRowLoading}
                                        loading={isRowLoading}
                                    >
                                        {t`Offer`}
                                    </Button>
                                )}
                            </Table.Td>
                        </Table.Tr>
                    );
                })}
            </Table.Tbody>
        </Table>
    </div>
);
