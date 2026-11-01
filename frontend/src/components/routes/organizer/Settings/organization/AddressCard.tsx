import {useMemo, useRef} from "react";
import {t} from "@lingui/macro";
import {Select, TextInput} from "@mantine/core";
import {useForm} from "@mantine/form";
import {IdParam, OrganizerSettings, VenueAddress} from "../../../../../types.ts";
import {useUpdateOrganizerSettings} from "../../../../../mutations/useUpdateOrganizerSettings.ts";
import {useSectionAutosave} from "../../../../layouts/AppLayout/PageStatus.tsx";
import countries from "../../../../../../data/countries.json";
import {countryName, SettingsCard, showServerErrors} from "../SettingsUi.tsx";
import classes from "../Settings.module.scss";

type Address = Required<Pick<VenueAddress, 'venue_name' | 'address_line_1' | 'address_line_2' | 'city' | 'state_or_region' | 'zip_or_postal_code' | 'country'>>;

const fromSettings = (settings: OrganizerSettings): Address => ({
    venue_name: settings.location_details?.venue_name ?? '',
    address_line_1: settings.location_details?.address_line_1 ?? '',
    address_line_2: settings.location_details?.address_line_2 ?? '',
    city: settings.location_details?.city ?? '',
    state_or_region: settings.location_details?.state_or_region ?? '',
    zip_or_postal_code: settings.location_details?.zip_or_postal_code ?? '',
    country: settings.location_details?.country ?? '',
});

// « Adresse »: the organizer's place; its name and city show on the public page.
export const AddressCard = ({organizerId, settings}: { organizerId: IdParam, settings: OrganizerSettings }) => {
    const updateSettings = useUpdateOrganizerSettings();
    const form = useForm<Address>({initialValues: fromSettings(settings)});
    const saved = useRef<Address>(fromSettings(settings));
    const latest = useRef(form.values);
    latest.current = form.values;

    const countryOptions = useMemo(() => countries
        .filter(country => country.value)
        .map(country => ({value: country.value, label: countryName(country.value, country.label)}))
        .sort((a, b) => a.label.localeCompare(b.label)), []);

    // The address is one setting: it is always sent whole.
    const queue = useSectionAutosave<Address>('address', () => updateSettings.mutateAsync({
        organizerId,
        organizerSettings: {location_details: {...latest.current}},
    }), {
        onSaved: (changes) => Object.entries(changes).forEach(([field, value]) => {
            saved.current = {...saved.current, [field]: value};
            form.clearFieldError(`location_details.${field}`);
        }),
        onFailed: (error) => showServerErrors(form, error),
    });

    const commit = (field: keyof Address, value: string = form.values[field]) => {
        if (value.trim() !== saved.current[field].trim()) {
            queue({[field]: value});
        }
    };

    const textField = (field: keyof Address, label: string, extra: Record<string, unknown> = {}) => (
        <TextInput
            className={classes.field}
            label={label}
            value={form.values[field]}
            error={form.errors[`location_details.${field}`]}
            onChange={(event) => form.setFieldValue(field, event.currentTarget.value)}
            onBlur={() => commit(field)}
            {...extra}
        />
    );

    return (
        <SettingsCard title={t`Address`} subtitle={t`The place name and the city are shown on your public page.`}>
            <div className={classes.fields}>
                <div className={classes.fieldsSpan}>{textField('venue_name', t`Office or venue name`, {maxLength: 255})}</div>
                <div className={classes.fieldsSpan}>{textField('address_line_1', t`Address`, {maxLength: 255})}</div>
                <div className={classes.fieldsSpan}>{textField('address_line_2', t`Apartment, suite or office (optional)`, {maxLength: 255})}</div>
                {textField('city', t`City`, {maxLength: 85})}
                {textField('zip_or_postal_code', t`Postal code`, {maxLength: 85})}
                {textField('state_or_region', t`Province`, {maxLength: 85})}
                <Select
                    className={classes.field}
                    label={t`Country`}
                    searchable
                    clearable
                    data={countryOptions}
                    value={form.values.country || null}
                    error={form.errors['location_details.country']}
                    onChange={(value) => {
                        form.setFieldValue('country', value ?? '');
                        commit('country', value ?? '');
                    }}
                />
            </div>
        </SettingsCard>
    );
};
