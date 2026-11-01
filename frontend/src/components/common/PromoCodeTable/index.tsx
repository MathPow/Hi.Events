import {t} from "@lingui/macro";
import {Event, PromoCode, PromoCodeDiscountType} from "../../../types.ts";
import {prettyDate, relativeDate} from "../../../utilites/dates.ts";
import {ActionIcon, Button, Menu, Table as MantineTable, Tooltip, UnstyledButton} from "@mantine/core";
import {Table, TableHead} from "../Table";
import {IconCheck, IconCopy, IconDotsVertical, IconLink, IconPencil, IconPlus, IconTrash} from "@tabler/icons-react";
import {useClipboard, useDisclosure} from "@mantine/hooks";
import {showSuccess} from "../../../utilites/notifications.tsx";
import {EditPromoCodeModal} from "../../modals/EditPromoCodeModal";
import {useState} from "react";
import {NoResultsSplash} from "../NoResultsSplash";
import {confirmationDialog} from "../../../utilites/confirmationDialog.tsx";
import {useDeletePromoCode} from "../../../mutations/useDeletePromoCode.ts";
import {eventHomepageUrl} from "../../../utilites/urlHelper.ts";
import {formatCurrency} from "../../../utilites/currency.ts";
import {intlLocale} from "../../../utilites/intlLocale.ts";
import {StatusTag, StatusTone} from "../StatusTag";
import classes from "./PromoCodeTable.module.scss";

interface PromoCodeTableProps {
    event: Event,
    promoCodes: PromoCode[],
    openCreateModal: () => void,
}

// The code as a coupon: click to copy it.
const CopyCode = ({code}: { code: string }) => {
    const clipboard = useClipboard({timeout: 1500});
    const value = code.toUpperCase();

    return (
        <UnstyledButton
            className={classes.code}
            title={t`Click to copy`}
            onClick={() => {
                clipboard.copy(value);
                showSuccess(`${value} ${t`copied to clipboard`}`);
            }}
        >
            {value}
            {clipboard.copied ? <IconCheck size={15} stroke={2.5}/> : <IconCopy size={15}/>}
        </UnstyledButton>
    );
};

// Same rules as PromoCodeDomainObject::isValid: expired, or used as many times as allowed.
const codeStatus = (code: PromoCode): { label: string, tone: StatusTone } => {
    if (code.expiry_date && new Date(code.expiry_date).getTime() < Date.now()) {
        return {label: t`Expired`, tone: 'neutral'};
    }
    if (code.max_allowed_usages && Number(code.order_usage_count) >= code.max_allowed_usages) {
        return {label: t`Limit reached`, tone: 'waiting'};
    }
    return {label: t`Active`, tone: 'ok'};
};

export const PromoCodeTable = ({event, promoCodes, openCreateModal}: PromoCodeTableProps) => {
    const [promoCodeId, setPromoCodeId] = useState<number | undefined>();
    const [editModalOpen, {open: openEditModal, close: closeEditModal}] = useDisclosure(false);
    const deleteMutation = useDeletePromoCode();
    const clipboard = useClipboard({timeout: 500});
    const eventProducts = event.product_categories?.flatMap(category => category.products ?? []);

    const handleEditModal = (promoCodeId: number | undefined) => {
        setPromoCodeId(promoCodeId);
        openEditModal();
    };

    const handleDeleteCode = (promoCodeId: number) => {
        confirmationDialog(
            t`Are you sure you want to delete this promo code?`,
            () => {
                deleteMutation.mutate({eventId: event.id, promoCodeId});
            }, {confirm: t`Delete`, cancel: t`Cancel`}
        );
    }

    const discount = (code: PromoCode) => {
        if (!code.discount || code.discount_type === PromoCodeDiscountType.None) {
            return t`None`;
        }

        if (code.discount_type === PromoCodeDiscountType.Fixed) {
            return formatCurrency(code.discount, event.currency);
        }

        return new Intl.NumberFormat(intlLocale(), {style: 'percent', maximumFractionDigits: 2})
            .format(code.discount / 100);
    };

    if (promoCodes.length === 0) {
        return (
            <NoResultsSplash
                heading={t`No Promo Codes to show`}
                icon="etiquette"
                subHeading={(
                    <p>
                        {t`Promo codes can be used to offer discounts, presale access, or provide special access to your event.`}
                    </p>
                )}
            >
                <Button leftSection={<IconPlus size={20}/>} onClick={() => openCreateModal()}>
                    {t`Create a Promo Code`}
                </Button>
            </NoResultsSplash>
        );
    }

    return (
        <>
            <Table>
                <TableHead>
                    <MantineTable.Tr>
                        <MantineTable.Th>{t`Code`}</MantineTable.Th>
                        <MantineTable.Th>{t`Discount`}</MantineTable.Th>
                        <MantineTable.Th>{t({message: 'Uses', context: 'promo code'})}</MantineTable.Th>
                        <MantineTable.Th>{t`Products`}</MantineTable.Th>
                        <MantineTable.Th>{t`Expires`}</MantineTable.Th>
                        <MantineTable.Th>{t`Status`}</MantineTable.Th>
                        <MantineTable.Th/>
                    </MantineTable.Tr>
                </TableHead>

                <MantineTable.Tbody>
                    {promoCodes.map(code => {
                        const status = codeStatus(code);
                        const productIds = (code.applicable_product_ids ?? []).map(Number);
                        const products = eventProducts?.filter(product => productIds.includes(Number(product.id))) ?? [];

                        return (
                            <MantineTable.Tr key={code.id}>
                                <MantineTable.Td>
                                    <CopyCode code={code.code}/>
                                </MantineTable.Td>
                                <MantineTable.Td>
                                    <span className={classes.discount}>{discount(code)}</span>
                                </MantineTable.Td>
                                <MantineTable.Td>
                                    <span className={classes.usage}>
                                        {code.order_usage_count ?? 0}
                                        <span className={classes.usageMax}>
                                            {' / '}
                                            {code.max_allowed_usages
                                                ? code.max_allowed_usages
                                                : <span title={t`Unlimited usages allowed`}>∞</span>}
                                        </span>
                                    </span>
                                </MantineTable.Td>
                                <MantineTable.Td>
                                    {productIds.length === 0 ? (
                                        <StatusTag tone="neutral">{t`All Products`}</StatusTag>
                                    ) : (
                                        <Tooltip
                                            multiline
                                            withArrow
                                            label={products.map(product => <div key={product.id}>{product.title}</div>)}
                                        >
                                            <span className={classes.productsTag}>
                                                <StatusTag tone="neutral">
                                                    {productIds.length} {t`Product(s)`}
                                                </StatusTag>
                                            </span>
                                        </Tooltip>
                                    )}
                                </MantineTable.Td>
                                <MantineTable.Td>
                                    {code.expiry_date ? (
                                        <Tooltip label={prettyDate(String(code.expiry_date), event.timezone)} withArrow>
                                            <span className={classes.expiry}>{relativeDate(String(code.expiry_date))}</span>
                                        </Tooltip>
                                    ) : t`Never`}
                                </MantineTable.Td>
                                <MantineTable.Td>
                                    <StatusTag tone={status.tone}>{status.label}</StatusTag>
                                </MantineTable.Td>
                                <MantineTable.Td>
                                    <Menu shadow="md" width={240} position="bottom-end">
                                        <Menu.Target>
                                            <ActionIcon className={classes.menuButton} variant="subtle"
                                                        aria-label={t`Manage`}>
                                                <IconDotsVertical size={20}/>
                                            </ActionIcon>
                                        </Menu.Target>

                                        <Menu.Dropdown>
                                            <Menu.Label>{t`Manage`}</Menu.Label>
                                            <Menu.Item leftSection={<IconPencil size={14}/>}
                                                       onClick={() => handleEditModal(code?.id)}>
                                                {t`Edit Code`}
                                            </Menu.Item>
                                            <Menu.Item leftSection={<IconLink size={14}/>}
                                                       onClick={() => {
                                                           clipboard.copy(eventHomepageUrl(event) + `?promo_code=${code?.code}`);
                                                           showSuccess(t`URL copied to clipboard`)
                                                       }}>
                                                {t`Copy URL`}
                                            </Menu.Item>
                                            <Menu.Divider/>

                                            <Menu.Label>{t`Danger zone`}</Menu.Label>
                                            <Menu.Item color="red"
                                                       onClick={() => handleDeleteCode(code?.id as number)}
                                                       leftSection={<IconTrash size={14}/>}>
                                                {t`Delete code`}
                                            </Menu.Item>
                                        </Menu.Dropdown>
                                    </Menu>
                                </MantineTable.Td>
                            </MantineTable.Tr>
                        )
                    })}
                </MantineTable.Tbody>
            </Table>

            {(promoCodeId && editModalOpen) &&
                <EditPromoCodeModal promoCodeId={promoCodeId} onClose={closeEditModal}/>}
        </>
    )
}
