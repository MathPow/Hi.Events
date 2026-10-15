import {t, Trans} from "@lingui/macro";
import {useParams} from "react-router";
import {useMemo, useState} from "react";
import {
    ActionIcon,
    Alert,
    Badge,
    Button,
    Checkbox,
    Menu,
    Modal,
    NumberInput,
    Stack,
    Table,
    Textarea,
} from "@mantine/core";
import {useForm} from "@mantine/form";
import {IconArrowBackUp, IconCheck, IconDots, IconHourglass, IconScale, IconShieldLock} from "@tabler/icons-react";
import {PageBody} from "../../../common/PageBody";
import {PageTitle} from "../../../common/PageTitle";
import {TableSkeleton} from "../../../common/TableSkeleton";
import {NoResultsSplash} from "../../../common/NoResultsSplash";
import {useGetEvent} from "../../../../queries/useGetEvent.ts";
import {useGetEventDeposits} from "../../../../queries/useGetEventDeposits.ts";
import {useUpdateOrderDeposit} from "../../../../mutations/useUpdateOrderDeposit.ts";
import {useSplitDepositRetention} from "../../../../mutations/useSplitDepositRetention.ts";
import {useFormErrorResponseHandler} from "../../../../hooks/useFormErrorResponseHandler.tsx";
import {showError, showSuccess} from "../../../../utilites/notifications.tsx";
import {formatCurrency} from "../../../../utilites/currency.ts";
import {Order, OrderDepositStatus} from "../../../../types.ts";
import classes from "./Deposits.module.scss";

const statusColor: Record<OrderDepositStatus, string> = {
    PENDING: 'gray',
    RECEIVED: 'blue',
    RETURNED: 'green',
    RETAINED: 'orange',
};

const remaining = (order: Order) => (order.deposit_amount || 0) - (order.deposit_retained_amount || 0);

const statusLabel = (order: Order): string => {
    switch (order.deposit_status) {
        case 'RECEIVED':
            return t`Received`;
        case 'RETURNED':
            return t`Returned`;
        case 'RETAINED':
            return remaining(order) > 0 ? t`Partly retained` : t`Retained`;
        default:
            return t`Awaiting`;
    }
};

const isSplittable = (order: Order) =>
    (order.deposit_status === 'RECEIVED' || order.deposit_status === 'RETAINED') && remaining(order) > 0;

interface RetainModalProps {
    order: Order;
    currency: string;
    onClose: () => void;
}

const RetainModal = ({order, currency, onClose}: RetainModalProps) => {
    const {eventId} = useParams();
    const mutation = useUpdateOrderDeposit();
    const errorHandler = useFormErrorResponseHandler();
    const form = useForm({
        initialValues: {
            retained_amount: order.deposit_retained_amount || order.deposit_amount || 0,
            note: order.deposit_note || '',
            notify: true,
        },
    });

    const handleSubmit = (values: typeof form.values) => {
        mutation.mutate({
            eventId,
            orderId: order.id,
            payload: {status: 'RETAINED', ...values},
        }, {
            onSuccess: () => {
                showSuccess(t`Deposit updated`);
                onClose();
            },
            onError: (error) => errorHandler(form, error),
        });
    };

    return (
        <Modal opened onClose={onClose} title={t`Retain deposit`}>
            <form onSubmit={form.onSubmit(handleSubmit)}>
                <Stack>
                    <NumberInput
                        {...form.getInputProps('retained_amount')}
                        label={t`Amount retained`}
                        description={t`Deposit: ${formatCurrency(order.deposit_amount || 0, currency)}. Return the difference to the participant.`}
                        decimalScale={2}
                        min={0}
                        max={order.deposit_amount}
                    />
                    <Textarea
                        {...form.getInputProps('note')}
                        label={t`Reason`}
                        description={t`Shown to the participant in the email.`}
                        autosize
                        minRows={2}
                    />
                    <Checkbox {...form.getInputProps('notify', {type: 'checkbox'})}
                              label={t`Email the participant`}/>
                    <Button type="submit" loading={mutation.isPending}>{t`Retain`}</Button>
                </Stack>
            </form>
        </Modal>
    );
};

interface SplitModalProps {
    orders: Order[];
    currency: string;
    onClose: () => void;
}

const SplitModal = ({orders, currency, onClose}: SplitModalProps) => {
    const {eventId} = useParams();
    const mutation = useSplitDepositRetention();
    const errorHandler = useFormErrorResponseHandler();
    const available = orders.reduce((sum, order) => sum + remaining(order), 0);
    const form = useForm({
        initialValues: {
            amount: 0,
            note: '',
            notify: true,
        },
        validate: {
            amount: (value) => value > 0 ? null : t`Enter the cost to share.`,
            note: (value) => value.trim() ? null : t`Explain what the amount is for.`,
        },
    });

    const share = available > 0 ? Math.round(form.values.amount / available * 1000) / 10 : 0;

    const handleSubmit = (values: typeof form.values) => {
        mutation.mutate({
            eventId,
            payload: {...values, order_ids: orders.map(order => order.id)},
        }, {
            onSuccess: () => {
                showSuccess(t`Cost shared between the deposits`);
                onClose();
            },
            onError: (error) => errorHandler(form, error),
        });
    };

    return (
        <Modal opened onClose={onClose} title={t`Share a cost between deposits`}>
            <form onSubmit={form.onSubmit(handleSubmit)}>
                <Stack>
                    <Alert variant="light" icon={<IconScale size={18}/>}>
                        <Trans>
                            The cost is shared between {orders.length} received deposits, in proportion to what is
                            left of each. With equal deposits, everyone pays the same share.
                        </Trans>
                    </Alert>
                    <NumberInput
                        {...form.getInputProps('amount')}
                        label={t`Total cost`}
                        description={t`At most ${formatCurrency(available, currency)}.`}
                        decimalScale={2}
                        min={0}
                        max={available}
                    />
                    {form.values.amount > 0 && available > 0 && (
                        <div className={classes.perPerson}>
                            <Trans>That is {share}% of what is left of each deposit.</Trans>
                        </div>
                    )}
                    <Textarea
                        {...form.getInputProps('note')}
                        label={t`Reason`}
                        description={t`Shown to each participant in the email, e.g. "Broken patio door".`}
                        autosize
                        minRows={2}
                    />
                    <Checkbox {...form.getInputProps('notify', {type: 'checkbox'})}
                              label={t`Email the participants`}/>
                    <Button type="submit" loading={mutation.isPending}>{t`Share the cost`}</Button>
                </Stack>
            </form>
        </Modal>
    );
};

const Deposits = () => {
    const {eventId} = useParams();
    const {data: event} = useGetEvent(eventId);
    const {data: orders} = useGetEventDeposits(eventId);
    const updateMutation = useUpdateOrderDeposit();
    const [selected, setSelected] = useState<number[]>([]);
    const [retainOrder, setRetainOrder] = useState<Order | null>(null);
    const [splitOpen, setSplitOpen] = useState(false);
    const currency = event?.currency || 'CAD';

    const totals = useMemo(() => {
        const sum = (filter: (order: Order) => boolean, value: (order: Order) => number) =>
            (orders || []).filter(filter).reduce((acc, order) => acc + value(order), 0);

        return {
            awaiting: sum(o => o.deposit_status === 'PENDING', o => o.deposit_amount || 0),
            held: sum(o => o.deposit_status === 'RECEIVED', o => o.deposit_amount || 0),
            retained: sum(o => o.deposit_status === 'RETAINED', o => o.deposit_retained_amount || 0),
            toReturn: sum(o => o.deposit_status === 'RETAINED', remaining),
            returned: sum(o => o.deposit_status === 'RETURNED', o => o.deposit_amount || 0),
        };
    }, [orders]);

    const splittable = (orders || []).filter(isSplittable);
    const splitTargets = selected.length
        ? splittable.filter(order => selected.includes(order.id as number))
        : splittable;

    const setStatus = (order: Order, status: OrderDepositStatus, notify = false) => {
        updateMutation.mutate({
            eventId,
            orderId: order.id,
            payload: {status, notify},
        }, {
            onSuccess: () => showSuccess(t`Deposit updated`),
            onError: () => showError(t`Could not update the deposit`),
        });
    };

    const toggle = (orderId: number) => setSelected(current =>
        current.includes(orderId) ? current.filter(id => id !== orderId) : [...current, orderId]
    );

    return (
        <PageBody>
            <PageTitle subheading={t`Deposits are sent separately by participants and are not part of your revenue. Mark them as received, then return or retain them after the event.`}>
                {t`Security Deposits`}
            </PageTitle>

            <div className={classes.stats}>
                <div className={classes.stat}>
                    <span>{t`Awaiting`}</span>
                    <strong>{formatCurrency(totals.awaiting, currency)}</strong>
                </div>
                <div className={classes.stat}>
                    <span>{t`Held`}</span>
                    <strong>{formatCurrency(totals.held, currency)}</strong>
                </div>
                <div className={classes.stat}>
                    <span>{t`Retained`}</span>
                    <strong>{formatCurrency(totals.retained, currency)}</strong>
                </div>
                <div className={classes.stat}>
                    <span>{t`Left to return`}</span>
                    <strong>{formatCurrency(totals.toReturn, currency)}</strong>
                </div>
                <div className={classes.stat}>
                    <span>{t`Returned`}</span>
                    <strong>{formatCurrency(totals.returned, currency)}</strong>
                </div>
            </div>

            <div className={classes.toolbar}>
                <Button
                    className={classes.splitButton}
                    leftSection={<IconScale size={16}/>}
                    disabled={!splitTargets.length}
                    onClick={() => setSplitOpen(true)}
                >
                    {selected.length
                        ? t`Share a cost between ${splitTargets.length} selected`
                        : t`Share a cost between all received deposits`}
                </Button>
            </div>

            <TableSkeleton isVisible={!orders}/>

            {orders && orders.length === 0 && (
                <NoResultsSplash
                    heading={t`No deposits yet`}
                    subHeading={(
                        <p>
                            {t`Set a security deposit on a product to start collecting deposits for this event.`}
                        </p>
                    )}
                />
            )}

            {orders && orders.length > 0 && (
                <div className={classes.tableWrap}>
                    <Table verticalSpacing="sm" highlightOnHover>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th/>
                                <Table.Th>{t`Order`}</Table.Th>
                                <Table.Th>{t`Participant`}</Table.Th>
                                <Table.Th>{t`Deposit`}</Table.Th>
                                <Table.Th>{t`Status`}</Table.Th>
                                <Table.Th>{t`Retained`}</Table.Th>
                                <Table.Th/>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {orders.map(order => (
                                <Table.Tr key={order.id}>
                                    <Table.Td>
                                        <Checkbox
                                            aria-label={t`Select`}
                                            disabled={!isSplittable(order)}
                                            checked={selected.includes(order.id as number)}
                                            onChange={() => toggle(order.id as number)}
                                        />
                                    </Table.Td>
                                    <Table.Td className={classes.mono}>{order.public_id}</Table.Td>
                                    <Table.Td>
                                        <div>{order.first_name} {order.last_name}</div>
                                        <div className={classes.muted}>{order.email}</div>
                                    </Table.Td>
                                    <Table.Td>{formatCurrency(order.deposit_amount || 0, currency)}</Table.Td>
                                    <Table.Td>
                                        <Badge variant="light" color={statusColor[order.deposit_status || 'PENDING']}>
                                            {statusLabel(order)}
                                        </Badge>
                                        {order.status === 'CANCELLED' && (
                                            <div className={classes.muted}>{t`Order cancelled`}</div>
                                        )}
                                    </Table.Td>
                                    <Table.Td>
                                        {order.deposit_retained_amount
                                            ? formatCurrency(order.deposit_retained_amount, currency)
                                            : '—'}
                                        {!!order.deposit_note && (
                                            <div className={classes.muted}>{order.deposit_note}</div>
                                        )}
                                    </Table.Td>
                                    <Table.Td>
                                        <Menu position="bottom-end" withinPortal>
                                            <Menu.Target>
                                                <ActionIcon variant="subtle" aria-label={t`Actions`}>
                                                    <IconDots size={18}/>
                                                </ActionIcon>
                                            </Menu.Target>
                                            <Menu.Dropdown>
                                                {order.deposit_status !== 'RECEIVED' && (
                                                    <Menu.Item leftSection={<IconCheck size={16}/>}
                                                               onClick={() => setStatus(order, 'RECEIVED')}>
                                                        {t`Mark as received`}
                                                    </Menu.Item>
                                                )}
                                                {order.deposit_status !== 'RETURNED' && (
                                                    <Menu.Item leftSection={<IconArrowBackUp size={16}/>}
                                                               onClick={() => setStatus(order, 'RETURNED', true)}>
                                                        {t`Return in full and notify`}
                                                    </Menu.Item>
                                                )}
                                                <Menu.Item leftSection={<IconShieldLock size={16}/>}
                                                           onClick={() => setRetainOrder(order)}>
                                                    {t`Retain all or part…`}
                                                </Menu.Item>
                                                {order.deposit_status !== 'PENDING' && (
                                                    <Menu.Item leftSection={<IconHourglass size={16}/>}
                                                               onClick={() => setStatus(order, 'PENDING')}>
                                                        {t`Back to awaiting`}
                                                    </Menu.Item>
                                                )}
                                            </Menu.Dropdown>
                                        </Menu>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </div>
            )}

            {retainOrder && (
                <RetainModal order={retainOrder} currency={currency} onClose={() => setRetainOrder(null)}/>
            )}

            {splitOpen && (
                <SplitModal orders={splitTargets} currency={currency} onClose={() => {
                    setSplitOpen(false);
                    setSelected([]);
                }}/>
            )}
        </PageBody>
    );
};

export default Deposits;
