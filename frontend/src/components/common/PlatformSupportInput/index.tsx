import {NumberInput} from '@mantine/core';
import {IconHeartHandshake} from '@tabler/icons-react';
import {t} from '@lingui/macro';
import {Card} from '../Card';
import {getConfig} from '../../../utilites/config.ts';
import {getCurrencySymbol} from '../../../utilites/currency.ts';

interface PlatformSupportInputProps {
    value: number;
    onChange: (value: number) => void;
    currency?: string;
    disabled?: boolean;
}

/**
 * Contribution volontaire a la plateforme, proposee au moment de payer.
 *
 * Rendue seulement si VITE_PLATFORM_SUPPORT_ENABLED est actif: sur une instance
 * ou personne n'heberge la billetterie pour le compte d'un tiers, la demande
 * n'aurait pas de sens.
 */
export const platformSupportEnabled = (): boolean =>
    getConfig('VITE_PLATFORM_SUPPORT_ENABLED') === 'true';

export const PlatformSupportInput = ({value, onChange, currency, disabled}: PlatformSupportInputProps) => {
    if (!platformSupportEnabled()) {
        return null;
    }

    const label = getConfig('VITE_PLATFORM_SUPPORT_LABEL')
        || t`Support the platform`;
    const description = getConfig('VITE_PLATFORM_SUPPORT_DESCRIPTION')
        || t`Optional. Helps cover the cost of hosting this ticketing service.`;

    return (
        <Card>
            <NumberInput
                decimalScale={2}
                fixedDecimalScale
                min={0}
                max={1000}
                disabled={disabled}
                leftSection={currency ? getCurrencySymbol(currency) : <IconHeartHandshake size={18}/>}
                // Defaut a 0, jamais vide: un champ vide se lit comme une valeur
                // a saisir, alors que la contribution est facultative.
                value={value}
                onChange={(next) => onChange(Number(next) || 0)}
                label={label}
                description={description}
                placeholder="0.00"
            />
        </Card>
    );
};
