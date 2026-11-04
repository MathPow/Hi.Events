import {t, Trans} from "@lingui/macro";
import {UseFormReturnType} from "@mantine/form";
import {Event, Product, ProductPriceType, ProductType, TaxAndFee, TaxAndFeeCalculationType, TaxAndFeeType} from "../../../types.ts";
import {
    ActionIcon,
    Alert,
    Button,
    Collapse,
    ComboboxItem,
    MultiSelect,
    NumberInput,
    Select,
    Switch,
    TextInput
} from "@mantine/core";
import {
    IconChevronDown,
    IconChevronUp,
    IconPlus,
    IconTrash,
    IconTrashOff,
} from "@tabler/icons-react";
import {useDisclosure} from "@mantine/hooks";
import {NavLink, useParams} from "react-router";
import {useEffect} from "react";
import {formatCurrency, getCurrencySymbol} from "../../../utilites/currency.ts";
import {useGetOrganizerSettings} from "../../../queries/useGetOrganizerSettings.ts";
import {useGetEvent} from "../../../queries/useGetEvent.ts";
import {useGetTaxesAndFees} from "../../../queries/useGetTaxesAndFees.ts";
import {Card} from "../../common/Card";
import classes from './ProductForm.module.scss';
import {Editor} from "../../common/Editor";
import {InputGroup} from "../../common/InputGroup";
import {CharitySplitInput} from "./CharitySplitInput";
import {SizedProductForm} from "./SizedProductForm";
import {showError} from "../../../utilites/notifications.tsx";
import classNames from "classnames";
import {DateTimeField} from "../../common/DateTimeField";
import {CreateTaxOrFeeModal} from "../../modals/CreateTaxOrFeeModal";
import {PillChoice, ToggleRow} from "../../routes/organizer/Settings/SettingsUi.tsx";
import settings from "../../routes/organizer/Settings/Settings.module.scss";

const ICONS = '/interface/admin/produits';

interface ProductFormProps {
    form: UseFormReturnType<Product>,
    product?: Product,
    event?: Event,
}

const ProductPriceTierForm = ({form, product, event}: ProductFormProps) => {
    return form?.values?.prices?.map((price, index) => {
        const existingPrice = product?.prices?.find((p) => Number(p.id) === Number(price.id));
        const deleteDisabled = form?.values?.prices?.length === 1 || (existingPrice && Number(existingPrice?.quantity_sold) > 0);
        const cannotDeleteTitle = (() => {
            if (existingPrice && Number(existingPrice?.quantity_sold) > 0) {
                return t`You cannot delete this price tier because there are already products sold for this tier. You can hide it instead.`
            }
            if (form?.values?.prices?.length === 1) {
                return t`You must have at least one price tier`
            }
            return '';
        })();

        return (
            <Card key={`price-${index}`} className={classes.priceTierCard}>
                <h3>{price.label || <Trans>Tier {index + 1}</Trans>}</h3>
                <InputGroup>
                    <NumberInput decimalScale={2}
                                 min={0}
                                 fixedDecimalScale
                                 leftSection={event?.currency ? getCurrencySymbol(event.currency) : ''}
                                 {...form.getInputProps(`prices.${index}.price`)}
                                 label={t`Price`}
                                 placeholder="19.99"/>
                    <TextInput
                        {...form.getInputProps(`prices.${index}.label`)}
                        label={t`Label`}
                        placeholder={t`Early bird`}
                        required
                    />
                </InputGroup>
                <NumberInput
                    placeholder={t`Unlimited`}
                    {...form.getInputProps(`prices.${index}.initial_quantity_available`)}
                    label={t`Quantity Available`}
                />
                <InputGroup>
                    <DateTimeField
                        clearable
                        label={t`Sale Start Date`}
                        value={price.sale_start_date as string | undefined}
                        error={form.errors[`prices.${index}.sale_start_date`]}
                        onChange={(value) => form.setFieldValue(`prices.${index}.sale_start_date`, value)}
                    />
                    <DateTimeField
                        clearable
                        label={t`Sale End Date`}
                        value={price.sale_end_date as string | undefined}
                        error={form.errors[`prices.${index}.sale_end_date`]}
                        onChange={(value) => form.setFieldValue(`prices.${index}.sale_end_date`, value)}
                    />
                </InputGroup>

                <Switch
                    mt={10}
                    description={t`Hiding a product will prevent users from seeing it on the event page.`}
                    {...form.getInputProps(`prices.${index}.is_hidden`, {type: 'checkbox'})}
                    label={t`Hide this tier from users`}
                />

                <ActionIcon
                    variant={'light'}
                    className={classNames([classes.removeTier, deleteDisabled && classes.disabled])}
                    title={cannotDeleteTitle}
                    onClick={() => {
                        if (deleteDisabled) {
                            showError(cannotDeleteTitle);
                            return;
                        }
                        form.removeListItem('prices', index)
                    }}
                >
                    {!deleteDisabled && <IconTrash size="1rem"/>}
                    {deleteDisabled && <IconTrashOff size="1rem"/>}
                </ActionIcon>
            </Card>
        );
    })
}

type Visibility = 'visible' | 'hidden' | 'code';

/**
 * Figma « Modifier le billet » (542:2407): type, name, price and quantity, sale period with the homemade
 * calendar, visibility, order limits. The rest (description, taxes, deposit, display rules…) under
 * « Plus d'options ».
 */
export const ProductForm = ({form, product}: ProductFormProps) => {
    const {eventId} = useParams();
    const [moreOpen, {toggle: toggleMore, open: openMore}] = useDisclosure(false);
    const [taxFeeModalOpen, {open: openTaxFeeModal, close: closeTaxFeeModal}] = useDisclosure(false);
    const hasSales = Number(product?.quantity_sold) > 0;
    const isFreeProduct = form.values.type === 'FREE';
    const isDonationProduct = form.values.type === 'DONATION';
    const {data: event} = useGetEvent(eventId);
    const {data: organizerSettings} = useGetOrganizerSettings(event?.organizer_id);
    // Le volet don n'apparait que si l'organisme est enregistre: sans numero
    // d'enregistrement, aucun recu ne sera emis, le champ n'aurait aucun effet.
    const isCharityEnabled = !!organizerSettings?.charity_registration_number;
    const showCharitySplit = isCharityEnabled && !isFreeProduct && !isDonationProduct
        && form.values.type !== ProductPriceType.Tiered
        && form.values.type !== ProductPriceType.Sized;

    // Le type DONATION annonce un don au sens fiscal. Tant que l'organisme n'est
    // pas configure (numero d'enregistrement absent), aucun recu ne peut etre
    // emis: on ferme l'option plutot que de laisser croire au contraire.
    // Un produit DEJA en DONATION reste modifiable, sinon on echouerait a
    // rouvrir un produit cree avant que le reglage ne soit vide.
    const isDonationLocked = !isCharityEnabled && product?.type !== ProductPriceType.Donation;

    const priceTypes = [
        {value: ProductPriceType.Paid, label: t({message: 'Paid', context: 'price type'})},
        {value: ProductPriceType.Free, label: t({message: 'Free', context: 'price type'})},
        ...(isDonationLocked ? [] : [{value: ProductPriceType.Donation, label: t({message: 'Donation', context: 'price type'})}]),
        {value: ProductPriceType.Tiered, label: t({message: 'Tiers', context: 'price type'})},
        {value: ProductPriceType.Sized, label: t({message: 'Options', context: 'list of a product with options'})},
    ];

    const {data: taxesAndFees} = useGetTaxesAndFees();

    const handleTaxOrFeeCreated = (taxOrFee: TaxAndFee) => {
        const currentIds = form.values.tax_and_fee_ids || [];
        form.setFieldValue('tax_and_fee_ids', [...currentIds, String(taxOrFee.id)]);
    };

    const taxAndFeeOptions = (type: TaxAndFeeType): ComboboxItem[] => {
        return taxesAndFees?.data
            ?.filter((item) => item.type === type)
            .map((item: TaxAndFee) => ({
                label: item.name + ' - ' + (item.calculation_type === TaxAndFeeCalculationType.Percentage
                    ? item.rate + '%'
                    : formatCurrency(Number(item.rate), event?.currency || 'USD')),
                value: String(item.id),
            })) || [];
    };

    useEffect(() => {
        if (form.values.type === ProductPriceType.Free) {
            form.setFieldValue('price', 0.00);
        }
    }, [form, form.values.type]);

    // The form no longer asks for a category first: a new product goes in the event's first one.
    useEffect(() => {
        if (event?.product_categories?.length && !form.values.product_category_id) {
            form.setFieldValue('product_category_id', String(event.product_categories[0].id));
        }
    }, [event?.product_categories]);

    // A refused field hidden under « Plus d'options » must show.
    useEffect(() => {
        const inMain = ['title', 'type', 'product_type', 'min_per_order', 'max_per_order', 'sale_start_date', 'sale_end_date'];
        if (Object.keys(form.errors).some(field => !inMain.includes(field) && !field.startsWith('prices'))) {
            openMore();
        }
    }, [form.errors]);

    const visibility: Visibility = form.values.is_hidden
        ? 'hidden'
        : form.values.is_hidden_without_promo_code ? 'code' : 'visible';

    const setVisibility = (value: Visibility) => {
        form.setFieldValue('is_hidden', value === 'hidden');
        form.setFieldValue('is_hidden_without_promo_code', value === 'code');
    };

    const toggle = (field: keyof Product, label: string, hint?: string) => (
        <ToggleRow
            label={label}
            hint={hint}
            checked={!!form.values[field]}
            onChange={(checked) => form.setFieldValue(field as string, checked)}
        />
    );

    const typeTile = (value: ProductType, title: string, text: string, icon: string) => (
        <button
            type="button"
            role="radio"
            aria-checked={form.values.product_type === value}
            className={classes.tile}
            disabled={hasSales}
            onClick={() => form.setFieldValue('product_type', value)}
        >
            <span className={classes.tileIcon}><img src={`${ICONS}/${icon}.svg`} width={20} height={20} alt=""/></span>
            <span className={classes.tileText}>
                <strong>{title}</strong>
                <span>{text}</span>
            </span>
        </button>
    );

    return (
        <div className={classes.form}>
            <div className={classes.group}>
                <p className={settings.fieldLabel}>{t({message: 'Type', context: 'event type'})}</p>
                <div className={classes.tiles} role="radiogroup" aria-label={t({message: 'Type', context: 'event type'})}>
                    {typeTile(ProductType.Ticket, t`Ticket`, t`Access to the event`, 'billet')}
                    {typeTile(ProductType.General, t`Product`, t`Sold as an extra at checkout`, 'sac')}
                </div>
                {hasSales && <p className={settings.hint}>{t`You cannot change the product type as there are attendees associated with this product.`}</p>}
                {form.errors.product_type && <p className={classes.error} role="alert">{form.errors.product_type}</p>}
            </div>

            <TextInput
                className={settings.field}
                {...form.getInputProps('title')}
                withAsterisk={false}
                label={t`Name`}
                placeholder={form.values.product_type === 'TICKET' ? t`VIP Ticket` : t`T-shirt`}
                required
            />

            <div className={classes.group}>
                <p className={settings.fieldLabel}>{t`Price type`}</p>
                <PillChoice
                    label={t`Price type`}
                    value={form.values.type as ProductPriceType}
                    options={priceTypes}
                    disabled={hasSales}
                    onChange={(value) => form.setFieldValue('type', value)}
                />
                {form.values.type === ProductPriceType.Tiered && (
                    <p className={settings.hint}>{t`Several prices for the same ticket: early bird, student…`}</p>
                )}
                {form.values.type === ProductPriceType.Sized && (
                    <p className={settings.hint}>{t`One price, a choice of options with their own stock: sizes, distances, categories.`}</p>
                )}
                {form.errors.type && <p className={classes.error} role="alert">{form.errors.type}</p>}
            </div>

            {form.values.type === ProductPriceType.Sized && (
                <SizedProductForm form={form} product={product} event={event}/>
            )}

            {form.values.type !== ProductPriceType.Tiered && form.values.type !== ProductPriceType.Sized && (
                <div className={settings.fields}>
                    <NumberInput
                        className={settings.field}
                        decimalScale={2}
                        min={0}
                        fixedDecimalScale
                        disabled={isFreeProduct}
                        leftSection={event?.currency ? getCurrencySymbol(event.currency) : ''}
                        {...form.getInputProps('prices.0.price')}
                        label={isDonationProduct ? t`Minimum Price` : t`Price`}
                        placeholder="19.99"
                    />
                    <NumberInput
                        className={settings.field}
                        min={0}
                        placeholder={t`Unlimited`}
                        {...form.getInputProps('prices.0.initial_quantity_available')}
                        label={t`Quantity available`}
                    />
                </div>
            )}

            {form.values.type === ProductPriceType.Tiered && (
                <div className={classes.priceTiers}>
                    <ProductPriceTierForm product={product} form={form} event={event}/>
                    <Button
                        className={classes.addTierButton}
                        size={'xs'}
                        variant={'light'}
                        leftSection={<IconPlus size={14}/>}
                        onClick={() =>
                            form.insertListItem('prices', {
                                price: 0,
                                label: undefined,
                                sale_end_date: undefined,
                                sale_start_date: undefined
                            })
                        }
                    >
                        {t`Add tier`}
                    </Button>
                </div>
            )}

            <div className={classes.group}>
                <p className={settings.fieldLabel}>{t`Sale period`}</p>
                <div className={settings.fields}>
                    <DateTimeField
                        clearable
                        placeholder={t`Start of sales`}
                        value={form.values.sale_start_date as string | undefined}
                        error={form.errors.sale_start_date}
                        onChange={(value) => form.setFieldValue('sale_start_date', value)}
                    />
                    <DateTimeField
                        clearable
                        placeholder={t`End of sales`}
                        defaultTime="23:30"
                        value={form.values.sale_end_date as string | undefined}
                        error={form.errors.sale_end_date}
                        onChange={(value) => form.setFieldValue('sale_end_date', value)}
                    />
                </div>
            </div>

            <div className={classes.group}>
                <p className={settings.fieldLabel}>{t`Visibility`}</p>
                <PillChoice
                    label={t`Visibility`}
                    value={visibility}
                    options={[
                        {value: 'visible', label: t`Visible`},
                        {value: 'hidden', label: t({message: 'Hidden', context: 'product visibility'})},
                        {value: 'code', label: t`With a code`},
                    ]}
                    onChange={setVisibility}
                />
                {visibility === 'code' && (
                    <p className={settings.hint}>
                        {t`You can create a promo code which targets this product on the`}{' '}
                        <NavLink target={'_blank'} to={'../promo-codes'}>{t`Promo Code page`}</NavLink>
                    </p>
                )}
            </div>

            <div className={settings.fields}>
                <NumberInput className={settings.field} {...form.getInputProps('min_per_order')}
                             min={0} label={t`Minimum per order`} placeholder="1"/>
                <NumberInput className={settings.field} {...form.getInputProps('max_per_order')}
                             min={0} label={t`Maximum per order`} placeholder="10"/>
            </div>

            <button type="button" className={classes.moreToggle} aria-expanded={moreOpen} onClick={toggleMore}>
                {moreOpen ? <IconChevronUp size={16}/> : <IconChevronDown size={16}/>}
                {t`More options`}
                {!moreOpen && <span>{t`Description, taxes, deposit, display`}</span>}
            </button>

            <Collapse in={moreOpen}>
                <div className={classes.form}>
                    <Editor
                        className={`${settings.description} ${classes.editor}`}
                        editorType="minimal"
                        label={t`Description`}
                        value={form.values.description || ''}
                        onChange={(value) => form.setFieldValue('description', value)}
                    />

                    {(event?.product_categories?.length ?? 0) > 1 && (
                        <Select
                            className={settings.field}
                            {...form.getInputProps('product_category_id')}
                            label={t`Product Category`}
                            description={t`Categories help you organize your products. This title will be displayed on the public event page.`}
                            placeholder={t`Select category...`}
                            data={event?.product_categories?.map((category) => ({
                                value: String(category.id),
                                label: category.name,
                            }))}
                        />
                    )}

                    {showCharitySplit && <CharitySplitInput form={form} currency={event?.currency}/>}

                    {!isDonationProduct && (
                        <NumberInput
                            className={settings.field}
                            decimalScale={2}
                            min={0}
                            leftSection={event?.currency ? getCurrencySymbol(event.currency) : undefined}
                            value={form.values.deposit_amount ?? ''}
                            onChange={(value) => form.setFieldValue('deposit_amount', value === '' ? null : Number(value))}
                            error={form.errors.deposit_amount}
                            label={t`Security deposit (per unit)`}
                            description={t`Optional. Sent separately by the participant and not included in the price. You return it, or keep part of it, from the Deposits page.`}
                            placeholder="0.00"
                        />
                    )}

                    <div className={classes.group}>
                        <MultiSelect
                            className={settings.field}
                            {...form.getInputProps('tax_and_fee_ids')}
                            label={t`Taxes and Fees`}
                            placeholder={t`Select...`}
                            data={[{
                                group: t`Taxes`,
                                items: taxAndFeeOptions(TaxAndFeeType.Tax),
                            }, {
                                group: t`Fees`,
                                items: taxAndFeeOptions(TaxAndFeeType.Fee),
                            }]}
                        />
                        <button type="button" className={settings.textButton} onClick={openTaxFeeModal}>
                            {t`Create Tax or Fee`}
                        </button>
                        {(form.values.type === ProductPriceType.Free && !!form.values.tax_and_fee_ids?.length) && (
                            <Alert>
                                <p>{t`You have taxes and fees added to a Free Product. Would you like to remove them?`}</p>
                                <Button onClick={() => form.setFieldValue('tax_and_fee_ids', [])} size={'xs'}>{t`Yes, remove them`}</Button>
                            </Alert>
                        )}
                    </div>

                    <div className={classes.group}>
                        {toggle('hide_before_sale_start_date', t`Hide product before sale start date`)}
                        {toggle('hide_after_sale_end_date', t`Hide product after sale end date`)}
                        {toggle('start_collapsed', t`Collapse this product when the event page is initially loaded`)}
                        {toggle('show_quantity_remaining', t`Show available product quantity`)}
                        {toggle('hide_when_sold_out', t`Hide product when sold out`)}
                        {toggle('waitlist_enabled', t`Enable Waitlist`, t`Allow customers to join a waitlist when this product is sold out`)}
                        {toggle('is_highlighted', t`Highlight this product`, t`Highlighted products will have a different background color to make them stand out on the event page.`)}
                        {form.values.is_highlighted && (
                            <TextInput
                                className={settings.field}
                                {...form.getInputProps('highlight_message')}
                                label={t`Highlight Message`}
                                description={t`An optional message to display on the highlighted product, e.g. "Selling fast 🔥" or "Best value"`}
                                placeholder={t`Selling fast 🔥`}
                                maxLength={255}
                            />
                        )}
                    </div>
                </div>
            </Collapse>

            {taxFeeModalOpen && (
                <CreateTaxOrFeeModal
                    onClose={closeTaxFeeModal}
                    onCreated={handleTaxOrFeeCreated}
                />
            )}
        </div>
    );
};
