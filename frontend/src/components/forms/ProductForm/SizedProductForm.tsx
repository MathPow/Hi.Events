import {ActionIcon, Button, Group, NumberInput, TextInput} from "@mantine/core";
import {UseFormReturnType} from "@mantine/form";
import {IconEye, IconEyeOff, IconPlus, IconTrash, IconTrashOff} from "@tabler/icons-react";
import {t, Trans} from "@lingui/macro";
import {i18n} from "@lingui/core";
import classNames from "classnames";
import {Event, Product, ProductPrice} from "../../../types.ts";
import {getCurrencySymbol} from "../../../utilites/currency.ts";
import {showError} from "../../../utilites/notifications.tsx";
import {InputLabelWithHelp} from "../../common/InputLabelWithHelp";
import classes from './ProductForm.module.scss';

interface SizedProductFormProps {
    form: UseFormReturnType<Product>;
    product?: Product;
    event?: Event;
}

const ADULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const YOUTH_SIZES = ['2', '4', '6', '8', '10', '12', '14'];
// The usual race distances, in km: written the way the organizer's language writes numbers (21,1 km).
const DISTANCES = [5, 10, 21.1, 42.2];

const newSize = (label: string | undefined, price: number): ProductPrice => ({
    price,
    label,
    sale_start_date: undefined,
    sale_end_date: undefined,
    initial_quantity_available: undefined,
    is_hidden: false,
});

export const SizedProductForm = ({form, product, event}: SizedProductFormProps) => {
    const prices = form.values.prices || [];
    const sharedPrice = Number(prices[0]?.price ?? 0);

    const setSharedPrice = (value: number | string) => {
        const price = Number(value) || 0;
        form.setFieldValue('prices', prices.map(p => ({...p, price})));
    };

    const addOptions = (labels: string[], heading: string) => {
        const existing = new Set(prices.map(p => (p.label || '').trim().toLowerCase()));
        const missing = labels.filter(label => !existing.has(label.toLowerCase()));

        // Une seule ligne vide (cas du produit qu'on vient de passer en
        // « tailles ») est remplacee plutot que gardee en tete de liste.
        const kept = prices.filter(p => p.id || (p.label || '').trim() !== '' || p.initial_quantity_available);

        form.setFieldValue('prices', [...kept, ...missing.map(label => newSize(label, sharedPrice))]);
        if (!(form.values.option_heading || '').trim()) {
            form.setFieldValue('option_heading', heading);
        }
    };

    const distances = () => DISTANCES.map(km => `${new Intl.NumberFormat(i18n.locale).format(km)} km`);

    const removeSize = (index: number) => {
        const existingPrice = product?.prices?.find(p => Number(p.id) === Number(prices[index]?.id));

        if (prices.length === 1) {
            showError(t`You must have at least one option`);
            return;
        }
        if (existingPrice && Number(existingPrice.quantity_sold) > 0) {
            showError(t`This option has already been sold. You can hide it instead.`);
            return;
        }

        form.removeListItem('prices', index);
    };

    const totalStock = prices.every(p => p.initial_quantity_available !== undefined && p.initial_quantity_available !== null && String(p.initial_quantity_available) !== '')
        ? prices.reduce((sum, p) => sum + Number(p.initial_quantity_available), 0)
        : null;

    return (
        <div className={classes.sizedProduct}>
            <NumberInput
                decimalScale={2}
                min={0}
                fixedDecimalScale
                leftSection={event?.currency ? getCurrencySymbol(event.currency) : ''}
                value={sharedPrice}
                onChange={setSharedPrice}
                error={form.errors['prices.0.price']}
                label={<InputLabelWithHelp
                    label={t`Price`}
                    helpText={t`The same price applies to every option. Please enter the price excluding taxes and fees.`}
                />}
                placeholder="25.00"
            />

            <TextInput
                {...form.getInputProps('option_heading')}
                value={form.values.option_heading ?? ''}
                maxLength={100}
                label={<InputLabelWithHelp
                    label={t`Heading shown to buyers`}
                    helpText={t`Shown above the options. Leave empty for « Choose an option ».`}
                />}
                placeholder={t`Choose your distance`}
            />

            <div className={classes.sizesHeader}>
                <span className={classes.sizesTitle}>{t({message: 'Options', context: 'list of a product with options'})}</span>
                <Group gap={6}>
                    <Button size={'compact-xs'} variant={'light'}
                            onClick={() => addOptions(ADULT_SIZES, t`Choose your size`)}>
                        {t`Adult XS–XXL`}
                    </Button>
                    <Button size={'compact-xs'} variant={'light'}
                            onClick={() => addOptions(YOUTH_SIZES, t`Choose your size`)}>
                        {t`Youth 2–14`}
                    </Button>
                    <Button size={'compact-xs'} variant={'light'}
                            onClick={() => addOptions(distances(), t`Choose your distance`)}>
                        {t`Distances 5–42 km`}
                    </Button>
                </Group>
            </div>

            {form.errors.prices && (
                <div className={classes.sizesError}>{form.errors.prices}</div>
            )}

            <div className={classes.sizeRows}>
                {prices.map((price, index) => {
                    const existingPrice = product?.prices?.find(p => Number(p.id) === Number(price.id));
                    const sold = Number(existingPrice?.quantity_sold ?? 0);
                    const deleteDisabled = prices.length === 1 || sold > 0;

                    return (
                        <div key={price.id ?? `new-${index}`}
                             className={classNames(classes.sizeRow, price.is_hidden && classes.sizeRowHidden)}>
                            <TextInput
                                {...form.getInputProps(`prices.${index}.label`)}
                                className={classes.sizeLabel}
                                placeholder={t`Option`}
                                aria-label={t`Option`}
                                required
                            />
                            <NumberInput
                                {...form.getInputProps(`prices.${index}.initial_quantity_available`)}
                                className={classes.sizeStock}
                                min={0}
                                placeholder={t`Unlimited`}
                                aria-label={t`Quantity Available`}
                            />
                            {sold > 0 && (
                                <span className={classes.sizeSold}><Trans>{sold} sold</Trans></span>
                            )}
                            <ActionIcon
                                variant={'subtle'}
                                color={'gray'}
                                title={price.is_hidden ? t`Show this option to buyers` : t`Hide this option from buyers`}
                                aria-pressed={!!price.is_hidden}
                                onClick={() => form.setFieldValue(`prices.${index}.is_hidden`, !price.is_hidden)}
                            >
                                {price.is_hidden ? <IconEyeOff size="1rem"/> : <IconEye size="1rem"/>}
                            </ActionIcon>
                            <ActionIcon
                                variant={'subtle'}
                                color={'gray'}
                                className={classNames(deleteDisabled && classes.disabled)}
                                title={sold > 0 ? t`This option has already been sold. You can hide it instead.` : t`Remove option`}
                                onClick={() => removeSize(index)}
                            >
                                {deleteDisabled ? <IconTrashOff size="1rem"/> : <IconTrash size="1rem"/>}
                            </ActionIcon>
                        </div>
                    );
                })}
            </div>

            <Group justify={'space-between'} mt={8}>
                <Button
                    size={'xs'}
                    variant={'light'}
                    leftSection={<IconPlus size={14}/>}
                    onClick={() => form.insertListItem('prices', newSize(undefined, sharedPrice))}
                >
                    {t`Add option`}
                </Button>
                <span className={classes.sizesTotal}>
                    {totalStock === null
                        ? t`Leave quantity empty for unlimited stock`
                        : t`Total stock: ${totalStock}`}
                </span>
            </Group>
        </div>
    );
}
