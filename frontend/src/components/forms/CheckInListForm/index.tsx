import {Button, Switch, Textarea, TextInput} from "@mantine/core";
import {IconCheck} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import {UseFormReturnType} from "@mantine/form";
import {useMemo} from "react";
import {CheckInListRequest, ProductCategory, ProductType} from "../../../types.ts";
import {DateTimeField} from "../../common/DateTimeField";
import settings from "../../routes/organizer/Settings/Settings.module.scss";
import classes from "./CheckInListForm.module.scss";

interface CheckInListFormProps {
    form: UseFormReturnType<CheckInListRequest>;
    productCategories: ProductCategory[];
    // Editing: a new PIN signs out the phones already open.
    isEditing?: boolean;
}

// The scanner's code: 4 digits, drawn by the browser's secure generator.
export const generateScannerPin = () => {
    const [value] = crypto.getRandomValues(new Uint32Array(1));
    return String(value % 10000).padStart(4, '0');
};

export const ticketIds = (productCategories: ProductCategory[]) => productCategories
    .flatMap(category => category.products || [])
    .filter(product => product.product_type === ProductType.Ticket)
    .map(product => String(product.id));

/**
 * Figma « Nouvelle liste d'entrée » (552:3244): the name, the description for the staff, the tickets
 * accepted, the opening hours with the homemade calendar, the scanner's PIN and on-site sales.
 */
export const CheckInListForm = ({form, productCategories, isEditing}: CheckInListFormProps) => {
    const tickets = useMemo(() => productCategories
        .flatMap(category => category.products || [])
        .filter(product => product.product_type === ProductType.Ticket), [productCategories]);

    const selected = (form.values.product_ids ?? []).map(String);

    const toggleTicket = (id: string) => {
        form.setFieldValue('product_ids', selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id]);
        form.clearFieldError('product_ids');
    };

    const pin = form.values.pin ?? '';

    return (
        <div className={classes.form}>
            <TextInput
                className={settings.field}
                {...form.getInputProps('name')}
                required
                withAsterisk={false}
                label={t`List name`}
                placeholder={t`E.g.: Main entrance`}
            />

            <Textarea
                className={settings.field}
                {...form.getInputProps('description')}
                label={(
                    <>
                        {t`Description`}
                        <span className={classes.labelNote}>{t`visible in the scanner`}</span>
                    </>
                )}
                autosize
                minRows={3}
            />

            <div className={classes.group}>
                <p className={settings.fieldLabel}>{t`Accepted tickets`}</p>
                <div className={settings.pills} role="group" aria-label={t`Accepted tickets`}>
                    {tickets.map(ticket => {
                        const id = String(ticket.id);
                        const checked = selected.includes(id);
                        return (
                            <button
                                key={id}
                                type="button"
                                role="checkbox"
                                aria-checked={checked}
                                className={settings.pill}
                                onClick={() => toggleTicket(id)}
                            >
                                {checked && <IconCheck size={16} stroke={2.25}/>}
                                {ticket.title}
                            </button>
                        );
                    })}
                </div>
                {form.errors.product_ids && <p className={classes.error} role="alert">{form.errors.product_ids}</p>}
            </div>

            <div className={classes.group}>
                <p className={settings.fieldLabel}>{t({message: 'Open', context: 'list hours'})}</p>
                <div className={classes.dates}>
                    <DateTimeField
                        clearable
                        placeholder={t`Opening`}
                        defaultTime="07:00"
                        value={form.values.activates_at}
                        error={form.errors.activates_at}
                        onChange={(value) => form.setFieldValue('activates_at', value)}
                    />
                    <DateTimeField
                        clearable
                        placeholder={t`Closing`}
                        defaultTime="11:00"
                        value={form.values.expires_at}
                        error={form.errors.expires_at}
                        onChange={(value) => form.setFieldValue('expires_at', value)}
                    />
                </div>
                <p className={settings.hint}>{t`Outside these hours, the scanner link shows « List closed ».`}</p>
            </div>

            <div className={classes.group}>
                <div className={classes.doorSale}>
                    <span className={classes.doorSaleIcon}>
                        <img src="/interface/admin/scanner/cadenas.svg" width={20} height={20} alt=""/>
                    </span>
                    <span className={settings.toggleText}>
                        <span className={settings.toggleLabel} id="list-pin">{t`Scanner PIN`}</span>
                        <span className={settings.toggleHint}>
                            {t`Asked when the link opens. If the link gets around, nobody can scan without the PIN.`}
                        </span>
                    </span>
                    <Switch
                        className={settings.switch}
                        withThumbIndicator={false}
                        aria-labelledby="list-pin"
                        checked={!!pin}
                        onChange={(event) => {
                            form.setFieldValue('pin', event.currentTarget.checked ? generateScannerPin() : '');
                            form.clearFieldError('pin');
                        }}
                    />
                </div>
                {!!pin && (
                    <>
                        <div className={classes.pinRow}>
                            <span className={classes.pin} aria-label={t`Scanner PIN`}>
                                <img src="/interface/admin/scanner/cadenas.svg" width={20} height={20} alt=""/>
                                <span className={classes.pinDigits}>{pin}</span>
                            </span>
                            <Button
                                variant="transparent"
                                className={settings.outlineButton}
                                onClick={() => form.setFieldValue('pin', generateScannerPin())}
                            >
                                {t`Generate a new PIN`}
                            </Button>
                        </div>
                        {isEditing && <p className={settings.hint}>{t`A new PIN signs out the phones already open.`}</p>}
                    </>
                )}
                {form.errors.pin && <p className={classes.error} role="alert">{form.errors.pin}</p>}
            </div>

            <div className={classes.doorSale}>
                <span className={classes.doorSaleIcon}>
                    <img src="/interface/admin/accueil/carte.svg" width={20} height={20} alt=""/>
                </span>
                <span className={settings.toggleText}>
                    <span className={settings.toggleLabel} id="list-door-sales">{t`Allow selling tickets on site`}</span>
                    <span className={settings.toggleHint}>
                        {t`If spots are left, staff can register someone in the scanner and take the payment with a card terminal.`}
                    </span>
                </span>
                <Switch
                    className={settings.switch}
                    withThumbIndicator={false}
                    aria-labelledby="list-door-sales"
                    {...form.getInputProps('allow_door_sales', {type: 'checkbox'})}
                />
            </div>
        </div>
    );
};
