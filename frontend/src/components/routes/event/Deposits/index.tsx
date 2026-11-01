import {t, Trans} from "@lingui/macro";
import {useParams} from "react-router";
import {useMemo, useState} from "react";
import {
    ActionIcon,
    Alert,
    Button,
    Checkbox,
    Menu,
    Modal,
    NumberInput,
    Stack,
    Table as MantineTable,
    Textarea,
} from "@mantine/core";
import {useForm} from "@mantine/form";
import {
    IconArrowBackUp,
    IconCheck,
    IconCircleCheck,
    IconDotsVertical,
    IconHourglass,
    IconScale,
    IconShieldLock,
} from "@tabler/icons-react";
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
import {getInitials} from "../../../../utilites/helpers.ts";
import {StatGrid, StatTile} from "../../../common/StatBoxes";
import {StatusTag, StatusTone} from "../../../common/StatusTag";
import {Table, TableHead} from "../../../common/Table";
import {ToolBar} from "../../../common/ToolBar";
import classes from "./Deposits.module.scss";

// Waiting for the money, held, kept (all or part), given back.
const statusTone: Record<OrderDepositStatus, StatusTone> = {
    PENDING: 'waiting',
    RECEIVED: 'ok',
    RETURNED: 'neutral',
    RETAINED: 'problem',
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
            <PageTitle
                subheading={t`Deposits are sent separately by participants and are not part of your revenue. Mark them as received, then return or retain them after the event.`}
                mobileSubheading={t`Deposits are not part of your revenue.`}
            >
                {t`Security Deposits`}
            </PageTitle>

            <StatGrid loading={!orders} className={classes.stats} compact>
                <StatTile tone="attendees" icon={<IconHourglass stroke={2}/>} label={t`Awaiting`}
                          value={formatCurrency(totals.awaiting, currency)}/>
                <StatTile tone="products" icon={<IconShieldLock stroke={2}/>} label={t`Held`}
                          value={formatCurrency(totals.held, currency)}/>
                <StatTile tone="refunds" icon={<IconScale stroke={2}/>} label={t`Retained`}
                          value={formatCurrency(totals.retained, currency)}/>
                <StatTile tone="orders" icon={<IconArrowBackUp stroke={2}/>} label={t`Left to return`}
                          value={formatCurrency(totals.toReturn, currency)}/>
                <StatTile tone="sales" icon={<IconCircleCheck stroke={2}/>} label={t`Returned`}
                          value={formatCurrency(totals.returned, currency)}/>
            </StatGrid>

            {orders && orders.length > 0 && (
                <ToolBar>
                    <Button
                        className={classes.splitButton}
                        leftSection={<IconScale size={20}/>}
                        disabled={!splitTargets.length}
                        onClick={() => setSplitOpen(true)}
                    >
                        {selected.length
                            ? t`Share a cost between ${splitTargets.length} selected`
                            : t`Share a cost between all received deposits`}
                    </Button>
                </ToolBar>
            )}

            <TableSkeleton isVisible={!orders}/>

            {orders && orders.length === 0 && (
                <NoResultsSplash
                    icon="cadenas"
                    heading={t`No deposits yet`}
                    subHeading={(
                        <p>
                            {t`Set a security deposit on a product to start collecting deposits for this event.`}
                        </p>
                    )}
                />
            )}

            {orders && orders.length > 0 && (
                <Table>
                    <TableHead>
                        <MantineTable.Tr>
                            <MantineTable.Th>{t`Participant`}</MantineTable.Th>
                            <MantineTable.Th>{t`Order`}</MantineTable.Th>
                            <MantineTable.Th>{t`Deposit`}</MantineTable.Th>
                            <MantineTable.Th>{t`Status`}</MantineTable.Th>
                            <MantineTable.Th>{t`Retained`}</MantineTable.Th>
                            <MantineTable.Th/>
                        </MantineTable.Tr>
                    </TableHead>
                    <MantineTable.Tbody>
                        {orders.map(order => {
                            const name = `${order.first_name ?? ''} ${order.last_name ?? ''}`.trim();

                            return (
                                <MantineTable.Tr key={order.id}>
                                    <MantineTable.Td>
                                        <div className={classes.participant}>
                                            <Checkbox
                                                aria-label={t`Select`}
                                                disabled={!isSplittable(order)}
                                                checked={selected.includes(order.id as number)}
                                                onChange={() => toggle(order.id as number)}
                                            />
                                            <span className={classes.avatar} aria-hidden>{getInitials(name || '?')}</span>
                                            <span className={classes.participantText}>
                                                <span className={classes.name}>{name}</span>
                                                <span className={classes.muted}>{order.email}</span>
                                            </span>
                                        </div>
                                    </MantineTable.Td>
                                    <MantineTable.Td>
                                        <span className={classes.reference}>#{order.public_id}</span>
                                    </MantineTable.Td>
                                    <MantineTable.Td>
                                        <span className={classes.amount}>{formatCurrency(order.deposit_amount || 0, currency)}</span>
                                    </MantineTable.Td>
                                    <MantineTable.Td>
                                        <div className={classes.status}>
                                            <StatusTag tone={statusTone[order.deposit_status || 'PENDING']}>
                                                {statusLabel(order)}
                                            </StatusTag>
                                            {order.status === 'CANCELLED' && (
                                                <span className={classes.muted}>{t`Order cancelled`}</span>
                                            )}
                                        </div>
                                    </MantineTable.Td>
                                    <MantineTable.Td>
                                        <div className={classes.retained}>
                                            <span className={classes.amount}>
                                                {order.deposit_retained_amount
                                                    ? formatCurrency(order.deposit_retained_amount, currency)
                                                    : '—'}
                                            </span>
                                            {!!order.deposit_note && (
                                                <span className={classes.note}>{order.deposit_note}</span>
                                            )}
                                        </div>
                                    </MantineTable.Td>
                                    <MantineTable.Td>
                                        <Menu position="bottom-end" width={270} withinPortal>
                                            <Menu.Target>
                                                <ActionIcon className={classes.menuButton} variant="subtle"
                                                            aria-label={t`Actions`}>
                                                    <IconDotsVertical size={20}/>
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
                                    </MantineTable.Td>
                                </MantineTable.Tr>
                            );
                        })}
                    </MantineTable.Tbody>
                </Table>
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
