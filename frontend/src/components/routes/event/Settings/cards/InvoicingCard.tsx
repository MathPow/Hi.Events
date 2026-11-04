import {t} from "@lingui/macro";
import {NumberInput, TextInput} from "@mantine/core";
import {EventSettings, IdParam} from "../../../../../types.ts";
import {useUpdateEventSettings} from "../../../../../mutations/useUpdateEventSettings.ts";
import {Editor} from "../../../../common/Editor";
import {SettingsCard, ToggleRow} from "../../../organizer/Settings/SettingsUi.tsx";
import {htmlOrNull, useAutosaveForm} from "../useAutosaveForm.ts";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

interface Invoicing {
    require_billing_address: boolean;
    enable_invoicing: boolean;
    invoice_label: string;
    invoice_prefix: string;
    invoice_start_number: number | string;
    invoice_payment_terms_days: number | string;
    organization_name: string;
    organization_address: string;
    invoice_tax_details: string;
    invoice_notes: string;
}

// Invoices need the organization's name and address: the three always leave together.
const REQUIRED: (keyof Invoicing)[] = ['enable_invoicing', 'organization_name', 'organization_address'];
const HTML: (keyof Invoicing)[] = ['organization_address', 'invoice_tax_details', 'invoice_notes'];

const toServer = (field: keyof Invoicing, value: unknown) => {
    if (HTML.includes(field)) {
        return htmlOrNull(value as string);
    }
    if (field === 'invoice_start_number' || field === 'invoice_payment_terms_days') {
        return value === '' || value === null ? null : Number(value);
    }
    return typeof value === 'string' ? value.trim() || null : value;
};

// « Facturation »: the billing address at checkout and the invoices sent with the orders.
export const InvoicingCard = ({eventId, settings}: { eventId: IdParam, settings: EventSettings }) => {
    const updateSettings = useUpdateEventSettings();
    const {form, commit, choose} = useAutosaveForm<Invoicing>({
        key: 'invoicing',
        initialValues: {
            require_billing_address: settings.require_billing_address ?? true,
            enable_invoicing: !!settings.enable_invoicing,
            invoice_label: settings.invoice_label ?? '',
            invoice_prefix: settings.invoice_prefix ?? '',
            invoice_start_number: settings.invoice_start_number ?? 1,
            invoice_payment_terms_days: settings.invoice_payment_terms_days ?? '',
            organization_name: settings.organization_name ?? '',
            organization_address: settings.organization_address ?? '',
            invoice_tax_details: settings.invoice_tax_details ?? '',
            invoice_notes: settings.invoice_notes ?? '',
        },
        html: HTML,
        save: (changes, values) => {
            const fields = Object.keys(changes) as (keyof Invoicing)[];
            const sent = fields.some(field => REQUIRED.includes(field)) ? [...new Set([...fields, ...REQUIRED])] : fields;
            return updateSettings.mutateAsync({
                eventId,
                eventSettings: Object.fromEntries(sent.map(field => [field, toServer(field, values[field])])) as Partial<EventSettings>,
            });
        },
    });

    const text = (field: keyof Invoicing, label: string, extraProps: Record<string, unknown> = {}) => (
        <TextInput
            className={classes.field}
            label={label}
            {...form.getInputProps(field)}
            onBlur={() => commit(field)}
            {...extraProps}
        />
    );

    const number = (field: keyof Invoicing, label: string, extraProps: Record<string, unknown> = {}) => (
        <NumberInput
            className={classes.field}
            label={label}
            allowDecimal={false}
            allowNegative={false}
            {...form.getInputProps(field)}
            onBlur={() => commit(field)}
            {...extraProps}
        />
    );

    const editor = (field: keyof Invoicing, label: string, description?: string) => (
        <Editor
            className={`${classes.description} ${extra.editor} ${extra.editorSmall}`}
            editorType="simple"
            label={label}
            description={description}
            value={form.values[field] as string}
            error={form.errors[field] as string | undefined}
            onChange={(value) => form.setFieldValue(field, value)}
            onBlur={() => commit(REQUIRED.includes(field) ? REQUIRED : field)}
        />
    );

    return (
        <SettingsCard
            id="invoice-settings"
            className={extra.anchored}
            title={t`Billing`}
            subtitle={t`Billing address and invoices sent with orders.`}
        >
            <ToggleRow
                label={t`Billing address required`}
                hint={t`Requested at payment.`}
                checked={form.values.require_billing_address}
                onChange={(checked) => choose('require_billing_address', checked)}
            />
            <ToggleRow
                label={t`Automatic invoices`}
                hint={t`One invoice per order, attached to the confirmation email and downloadable.`}
                checked={form.values.enable_invoicing}
                onChange={(checked) => choose('enable_invoicing', checked, REQUIRED)}
            />

            {form.values.enable_invoicing && (
                <>
                    <hr className={classes.separator}/>
                    <div className={`${classes.fields} ${extra.singleColumn}`}>
                        <TextInput
                            className={classes.field}
                            label={t`Organization Name`}
                            maxLength={255}
                            {...form.getInputProps('organization_name')}
                            onBlur={() => commit(REQUIRED)}
                        />
                        {text('invoice_label', t`Document Label`, {
                            maxLength: 50,
                            placeholder: t`Invoice`,
                            description: t`Leave blank to use the default word "Invoice"`,
                        })}
                        <div className={classes.fieldsSpan}>{editor('organization_address', t`Organization Address`)}</div>
                        {text('invoice_prefix', t`Number Prefix`, {
                            maxLength: 10,
                            placeholder: 'INV-',
                            description: t`Optional prefix for invoice numbers (e.g., INV-)`,
                        })}
                        {number('invoice_start_number', t`First Invoice Number`, {
                            min: 1,
                            description: t`Cannot be changed once invoices have been generated.`,
                        })}
                        <div className={classes.fieldsSpan}>
                            {number('invoice_payment_terms_days', t`Payment Due Period`, {
                                min: 0,
                                max: 365,
                                placeholder: '30',
                                suffix: ` ${t`days`}`,
                                description: t`Number of days allowed for payment (leave blank to omit payment terms from invoices)`,
                            })}
                        </div>
                        {editor(
                            'invoice_tax_details',
                            t`Tax Details`,
                            t`Tax information to appear at the bottom of all invoices (e.g., VAT number, tax registration)`,
                        )}
                        {editor(
                            'invoice_notes',
                            t`Invoice Notes`,
                            t`Optional additional information to appear on all invoices (e.g., payment terms, late payment fees, return policy)`,
                        )}
                    </div>
                </>
            )}
        </SettingsCard>
    );
};
