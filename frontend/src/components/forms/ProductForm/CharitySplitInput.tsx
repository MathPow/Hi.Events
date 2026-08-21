import {Alert, NumberInput} from '@mantine/core';
import {UseFormReturnType} from '@mantine/form';
import {IconReceipt2} from '@tabler/icons-react';
import {t, Trans} from '@lingui/macro';
import {InputGroup} from '../../common/InputGroup';
import {getCurrencySymbol} from '../../../utilites/currency.ts';
import {formatCurrency} from '../../../utilites/currency.ts';

interface CharitySplitInputProps {
    form: UseFormReturnType<any>;
    currency?: string;
}

/**
 * Decoupe d'un billet-benefice en « contrepartie » et « don ».
 *
 * L'utilisateur saisit les deux montants; le prix reellement facture
 * (prices.0.price) est leur somme, tenue a jour ici. On ne stocke pas la part
 * billet: elle se deduit de price - charity_amount, ce qui evite deux sources
 * de verite qui divergeraient au premier arrondi.
 */
export const CharitySplitInput = ({form, currency}: CharitySplitInputProps) => {
    const totalPrice = Number(form.values.prices?.[0]?.price ?? 0);
    const charityAmount = Number(form.values.charity_amount ?? 0);
    const ticketAmount = Math.max(0, Number((totalPrice - charityAmount).toFixed(2)));

    const symbol = currency ? getCurrencySymbol(currency) : '';

    const applySplit = (nextTicket: number, nextCharity: number) => {
        const ticket = Number.isFinite(nextTicket) ? Math.max(0, nextTicket) : 0;
        const charity = Number.isFinite(nextCharity) ? Math.max(0, nextCharity) : 0;

        form.setFieldValue('charity_amount', charity);
        form.setFieldValue('prices.0.price', Number((ticket + charity).toFixed(2)));
    };

    return (
        <>
            <InputGroup>
                <NumberInput
                    decimalScale={2}
                    fixedDecimalScale
                    min={0}
                    leftSection={symbol}
                    value={ticketAmount}
                    onChange={(value) => applySplit(Number(value), charityAmount)}
                    label={t`Ticket amount`}
                    description={t`Fair market value of what the buyer receives.`}
                    placeholder="60.00"
                />
                <NumberInput
                    decimalScale={2}
                    fixedDecimalScale
                    min={0}
                    leftSection={symbol}
                    value={charityAmount}
                    onChange={(value) => applySplit(ticketAmount, Number(value))}
                    label={t`Donation amount`}
                    description={t`Eligible for an official tax receipt.`}
                    placeholder="90.00"
                />
            </InputGroup>

            <Alert icon={<IconReceipt2 size={18}/>} mb={20} variant="light">
                <Trans>
                    Buyers are charged {formatCurrency(totalPrice, currency || 'CAD')}, of which{' '}
                    {formatCurrency(charityAmount, currency || 'CAD')} appears on the official tax receipt.
                    The remainder is the advantage received and is not receiptable.
                </Trans>
            </Alert>
        </>
    );
};
