import {useEffect, useRef, useState} from 'react';
import {NumberInput} from '@mantine/core';
import {t} from '@lingui/macro';
import {getConfig} from '../../../utilites/config.ts';
import {getCurrencySymbol} from '../../../utilites/currency.ts';
import {intlLocale} from '../../../utilites/intlLocale.ts';
import {PublicIcon} from '../PublicIcon';
import classes from './PlatformSupportInput.module.scss';

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

export const PLATFORM_SUPPORT_MAX = 1000;

// Les pastilles de la maquette (« Don (active par defaut) »), plus 0 $ pour ne rien donner.
const PRESETS = [0, 1, 2, 5];

/**
 * Montant propose d'entree de jeu, dans l'unite majeure de la devise. L'acheteur
 * reste libre de le baisser, jusqu'a zero.
 */
export const platformSupportDefaultAmount = (): number => {
    const configured = Number(getConfig('VITE_PLATFORM_SUPPORT_DEFAULT'));

    if (!Number.isFinite(configured) || configured <= 0) {
        return 0;
    }

    return Math.min(configured, PLATFORM_SUPPORT_MAX);
};

// Le nom de la ligne, a la caisse comme dans le recapitulatif de la commande.
export const platformSupportLabel = (): string => t`Support DehorsQC`;

// « 1 $ », « 2,50 $ »: sans decimales quand le montant est rond, comme sur les pastilles.
const amountLabel = (amount: number, currency = 'CAD') => new Intl.NumberFormat(intlLocale(), {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
}).format(amount);

/**
 * La carte « Soutenir DehorsQC » de la maquette (Public · Checkout): un coeur, le titre, puis
 * des pastilles 0, 1, 2 et 5 $; « Autre » ouvre un champ pour un montant libre.
 */
export const PlatformSupportInput = ({value, onChange, currency, disabled}: PlatformSupportInputProps) => {
    // Un montant hors des pastilles (le montant par defaut, par exemple) s'ecrit dans le champ.
    const [custom, setCustom] = useState(() => !PRESETS.includes(value));
    // Chaque clic sur « Autre » demande le focus du champ (0: jamais demande).
    const [focusRequest, setFocusRequest] = useState(0);
    const customInput = useRef<HTMLInputElement>(null);

    // Ouvert par « Autre » (pas au chargement de la page): on y ecrit tout de suite, par-dessus le
    // montant d'avant. Apres le rendu du champ, qui replace son curseur en prenant le focus.
    useEffect(() => {
        if (!focusRequest) {
            return;
        }
        const timer = setTimeout(() => {
            customInput.current?.focus();
            customInput.current?.select();
        }, 50);

        return () => clearTimeout(timer);
    }, [focusRequest]);

    if (!platformSupportEnabled()) {
        return null;
    }

    const label = platformSupportLabel();

    return (
        <section className={classes.card} data-rough="stroke">
            <div className={classes.head}>
                <span className={classes.icon} data-rough><PublicIcon name={'coeur'} size={20}/></span>
                <span className={classes.text}>
                    <span className={classes.title}>{label}</span>
                    <span className={classes.description}>{t`A small donation helps keep outings affordable.`}</span>
                </span>
            </div>

            <div className={classes.amounts} role="radiogroup" aria-label={label}>
                {PRESETS.map((amount) => {
                    const checked = !custom && value === amount;

                    return (
                        <button key={amount} type="button" role="radio" aria-checked={checked}
                                className={classes.pill} data-rough="button" disabled={disabled}
                                onClick={() => {
                                    setCustom(false);
                                    onChange(amount);
                                }}>
                            {amountLabel(amount, currency)}
                        </button>
                    );
                })}
                <button type="button" role="radio" aria-checked={custom}
                        className={classes.pill} data-rough="button" disabled={disabled}
                        onClick={() => {
                            setCustom(true);
                            setFocusRequest((request) => request + 1);
                        }}>
                    {t`Other`}
                </button>
            </div>

            {custom && (
                <NumberInput
                    className={classes.customAmount}
                    aria-label={t`Amount`}
                    decimalScale={2}
                    min={0}
                    max={PLATFORM_SUPPORT_MAX}
                    disabled={disabled}
                    leftSection={currency ? getCurrencySymbol(currency) : undefined}
                    value={value}
                    onChange={(next) => onChange(Number(next) || 0)}
                    // eslint-disable-next-line lingui/no-unlocalized-strings
                    placeholder="0.00"
                    ref={customInput}
                />
            )}
        </section>
    );
};
