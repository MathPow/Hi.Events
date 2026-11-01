import {useRef} from "react";
import {t} from "@lingui/macro";
import {Select, TextInput} from "@mantine/core";
import {useForm} from "@mantine/form";
import {IdParam, Organizer} from "../../../../../types.ts";
import {useUpdateOrganizer} from "../../../../../mutations/useUpdateOrganizer.ts";
import {currencies} from "../../../../../../data/currencies.ts";
import {timezones} from "../../../../../../data/timezones.ts";
import {Editor} from "../../../../common/Editor";
import {useSectionAutosave} from "../../../../layouts/AppLayout/PageStatus.tsx";
import {cleanDescription} from "../../OrganizerHomepageDesigner/homepageDraft.ts";
import {currencyName, SettingsCard, showServerErrors} from "../SettingsUi.tsx";
import classes from "../Settings.module.scss";

type BasicInfo = Required<Pick<Organizer, 'name' | 'email' | 'phone' | 'website' | 'donation_url' | 'description' | 'currency' | 'timezone'>>;

const fromOrganizer = (organizer: Organizer): BasicInfo => ({
    name: organizer.name ?? '',
    email: organizer.email ?? '',
    phone: organizer.phone ?? '',
    website: organizer.website ?? '',
    donation_url: organizer.donation_url ?? '',
    description: organizer.description ?? '',
    currency: organizer.currency ?? '',
    timezone: organizer.timezone ?? '',
});

const CURRENCY_OPTIONS = () => Object.entries(currencies).map(([label, code]) => ({
    value: code,
    label: currencyName(code, label),
}));

// « Infos de base »: the organizer itself (name, contact, description, currency and timezone).
export const BasicInfoCard = ({organizerId, organizer}: { organizerId: IdParam, organizer: Organizer }) => {
    const updateOrganizer = useUpdateOrganizer();
    const form = useForm<BasicInfo>({initialValues: fromOrganizer(organizer)});
    const saved = useRef<BasicInfo>(fromOrganizer(organizer));
    const latest = useRef(form.values);
    latest.current = form.values;

    // The organizer is saved whole: every request carries all its fields as they are now.
    const queue = useSectionAutosave<BasicInfo>('organizer', () => updateOrganizer.mutateAsync({
        organizerId,
        organizerData: {
            ...latest.current,
            description: cleanDescription(latest.current.description),
        },
    }), {
        onSaved: (changes) => Object.entries(changes).forEach(([field, value]) => {
            saved.current = {...saved.current, [field]: value};
            form.clearFieldError(field);
        }),
        onFailed: (error) => showServerErrors(form, error),
    });

    const commit = (field: keyof BasicInfo, value: string = form.values[field]) => {
        const same = field === 'description'
            ? cleanDescription(value) === cleanDescription(saved.current.description)
            : value.trim() === saved.current[field].trim();
        if (!same) {
            queue({[field]: value});
        }
    };

    const textField = (field: keyof BasicInfo, label: string, extra: Record<string, unknown> = {}) => (
        <TextInput
            className={classes.field}
            label={label}
            {...form.getInputProps(field)}
            onBlur={() => commit(field)}
            {...extra}
        />
    );

    const select = (field: 'currency' | 'timezone', value: string | null) => {
        if (!value) {
            return;
        }
        form.setFieldValue(field, value);
        commit(field, value);
    };

    return (
        <SettingsCard
            full
            title={t`Basic info`}
            subtitle={t`Shown on your public page and in emails.`}
        >
            <div className={`${classes.fields} ${classes.fieldsColumns}`}>
                {textField('name', t`Organizer Name`, {maxLength: 100, required: true, withAsterisk: false})}
                {textField('email', t`Contact email`, {type: 'email', required: true, withAsterisk: false})}
                {textField('phone', t`Phone`, {type: 'tel', maxLength: 25})}
                {textField('website', t`Website`, {type: 'url', placeholder: 'https://'})}
            </div>

            <div>
                <Editor
                    className={classes.description}
                    label={t`Description`}
                    value={form.values.description}
                    editorType={'minimal'}
                    maxLength={1200}
                    error={form.errors.description as string | undefined}
                    onChange={(value) => form.setFieldValue('description', value)}
                    onBlur={() => commit('description', latest.current.description)}
                />
                <p className={classes.hint} style={{marginTop: '0.5rem'}}>
                    {t`Bold, italic, link and list only. Also editable in My page.`}
                </p>
            </div>

            <div className={classes.fields}>
                <Select
                    className={classes.field}
                    label={t`Currency`}
                    searchable
                    allowDeselect={false}
                    data={CURRENCY_OPTIONS()}
                    value={form.values.currency}
                    error={form.errors.currency}
                    onChange={(value) => select('currency', value)}
                />
                <Select
                    className={classes.field}
                    label={t`Timezone`}
                    searchable
                    allowDeselect={false}
                    data={timezones}
                    value={form.values.timezone}
                    error={form.errors.timezone}
                    onChange={(value) => select('timezone', value)}
                />
                <div className={classes.fieldsSpan}>
                    {textField('donation_url', t`Donation link`, {
                        type: 'url',
                        placeholder: 'https://',
                        description: t`Shown on your public organizer page so visitors can donate.`,
                    })}
                </div>
            </div>
        </SettingsCard>
    );
};
