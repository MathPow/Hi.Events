import {useState} from "react";
import {t} from "@lingui/macro";
import {Button, Menu} from "@mantine/core";
import {IconDotsVertical, IconPencil, IconPercentage, IconReceipt, IconTrash} from "@tabler/icons-react";
import {TaxAndFee, TaxAndFeeCalculationType, TaxAndFeeType} from "../../../../../types.ts";
import {useGetTaxesAndFees} from "../../../../../queries/useGetTaxesAndFees.ts";
import {useDeleteTaxOrFee} from "../../../../../mutations/useDeleteTaxOrFee.ts";
import {formatCurrency} from "../../../../../utilites/currency.ts";
import {showError, showSuccess} from "../../../../../utilites/notifications.tsx";
import {confirmationDialog} from "../../../../../utilites/confirmationDialog.tsx";
import {CreateTaxOrFeeModal} from "../../../../modals/CreateTaxOrFeeModal";
import {EditTaxOrFeeModal} from "../../../../modals/EditTaxOrFeeModal";
import {SettingsCard, Tag} from "../SettingsUi.tsx";
import classes from "../Settings.module.scss";

// « Taxes et frais »: the account's taxes and fees, to add to products.
export const TaxesAndFeesCard = ({currency}: { currency: string }) => {
    const {data: taxesAndFees, isFetched} = useGetTaxesAndFees();
    const deleteMutation = useDeleteTaxOrFee();
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState<TaxAndFee | null>(null);
    const items = taxesAndFees?.data ?? [];

    const remove = (taxOrFee: TaxAndFee) => {
        const name = taxOrFee.name;
        confirmationDialog(
            t`Delete ${name}?`,
            () => deleteMutation.mutate({taxAndFeeId: taxOrFee.id, accountId: taxOrFee.account_id}, {
                onSuccess: () => showSuccess(t`Tax or Fee deleted successfully`),
                onError: () => showError(t`Something went wrong while deleting the Tax or Fee`),
            }),
            {confirm: t`Delete`, cancel: t`Cancel`},
        );
    };

    return (
        <SettingsCard
            title={t`Taxes and fees`}
            subtitle={t`Added to the price of the products you choose, in all your events.`}
        >
            {isFetched && items.length === 0 && (
                <p className={classes.empty}>{t`No Taxes or Fees have been added.`}</p>
            )}

            {items.length > 0 && (
                <div className={classes.list}>
                    {items.map(item => {
                        const isTax = item.type === TaxAndFeeType.Tax;
                        return (
                            <div key={item.id} className={classes.listRow}>
                                <span className={classes.pastille}>
                                    {isTax ? <IconPercentage size={18} stroke={2}/> : <IconReceipt size={18} stroke={2}/>}
                                </span>
                                <span className={classes.listRowText}>
                                    <span className={classes.listRowTitle}>{item.name}</span>
                                    <span className={classes.listRowHint}>
                                        {isTax ? t`Tax` : t`Fee`}{!item.is_active && ` · ${t`Inactive`}`}
                                    </span>
                                </span>
                                <span className={classes.listValue}>
                                    {item.calculation_type === TaxAndFeeCalculationType.Percentage
                                        ? `${item.rate} %`
                                        : formatCurrency(Number(item.rate), currency)}
                                </span>
                                {item.is_default && <Tag tone="neutral">{t`Default`}</Tag>}
                                <Menu position="bottom-end" withinPortal>
                                    <Menu.Target>
                                        <button type="button" className={classes.iconButton} aria-label={t`Actions`}>
                                            <IconDotsVertical size={18}/>
                                        </button>
                                    </Menu.Target>
                                    <Menu.Dropdown>
                                        <Menu.Item leftSection={<IconPencil size={16}/>} onClick={() => setEditing(item)}>
                                            {t`Edit`}
                                        </Menu.Item>
                                        <Menu.Item color="red" leftSection={<IconTrash size={16}/>} onClick={() => remove(item)}>
                                            {t`Delete`}
                                        </Menu.Item>
                                    </Menu.Dropdown>
                                </Menu>
                            </div>
                        );
                    })}
                </div>
            )}

            <Button variant="transparent" className={classes.outlineButton} onClick={() => setCreating(true)} style={{alignSelf: 'flex-start'}}>
                {t`Add Tax or Fee`}
            </Button>

            {creating && <CreateTaxOrFeeModal onClose={() => setCreating(false)}/>}
            {editing && <EditTaxOrFeeModal taxOrFee={editing} onClose={() => setEditing(null)}/>}
        </SettingsCard>
    );
};
