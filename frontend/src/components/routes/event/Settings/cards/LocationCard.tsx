import {useMemo} from "react";
import {t} from "@lingui/macro";
import {Select, TextInput} from "@mantine/core";
import {EventSettings, IdParam} from "../../../../../types.ts";
import {useUpdateEventSettings} from "../../../../../mutations/useUpdateEventSettings.ts";
import countries from "../../../../../../data/countries.json";
import {Editor} from "../../../../common/Editor";
import {countryName, SettingsCard, ToggleRow} from "../../../organizer/Settings/SettingsUi.tsx";
import {htmlOrNull, useAutosaveForm} from "../useAutosaveForm.ts";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

interface Location {
    is_online_event: boolean;
    online_event_connection_details: string;
    venue_name: string;
    address_line_1: string;
    address_line_2: string;
    city: string;
    state_or_region: string;
    zip_or_postal_code: string;
    country: string;
    maps_url: string;
}

const ADDRESS: (keyof Location)[] = ['venue_name', 'address_line_1', 'address_line_2', 'city', 'state_or_region', 'zip_or_postal_code', 'country'];

const fromSettings = (settings: EventSettings): Location => ({
    is_online_event: !!settings.is_online_event,
    online_event_connection_details: settings.online_event_connection_details ?? '',
    venue_name: settings.location_details?.venue_name ?? '',
    address_line_1: settings.location_details?.address_line_1 ?? '',
    address_line_2: settings.location_details?.address_line_2 ?? '',
    city: settings.location_details?.city ?? '',
    state_or_region: settings.location_details?.state_or_region ?? '',
    zip_or_postal_code: settings.location_details?.zip_or_postal_code ?? '',
    country: settings.location_details?.country ?? '',
    maps_url: settings.maps_url ?? '',
});

// « Lieu »: a place's name is enough (a park, a mountain); a street address needs its city, postal code and country.
export const LocationCard = ({eventId, settings}: { eventId: IdParam, settings: EventSettings }) => {
    const updateSettings = useUpdateEventSettings();
    const {form, commit, choose, groupBlur} = useAutosaveForm<Location>({
        key: 'location',
        initialValues: fromSettings(settings),
        html: ['online_event_connection_details'],
        save: (changes, values) => {
            const eventSettings: Partial<EventSettings> = {};
            if ('is_online_event' in changes) {
                eventSettings.is_online_event = values.is_online_event;
            }
            if ('online_event_connection_details' in changes) {
                eventSettings.online_event_connection_details = htmlOrNull(values.online_event_connection_details) as string;
            }
            if ('maps_url' in changes) {
                eventSettings.maps_url = values.maps_url.trim() || null as unknown as string;
            }
            // The address is one setting: always sent whole.
            if (ADDRESS.some(field => field in changes)) {
                eventSettings.location_details = Object.fromEntries(ADDRESS.map(field => [field, (values[field] as string).trim()]));
            }
            return updateSettings.mutateAsync({eventId, eventSettings});
        },
    });

    const countryOptions = useMemo(() => countries
        .filter(country => country.value)
        .map(country => ({value: country.value, label: countryName(country.value, country.label)}))
        .sort((a, b) => a.label.localeCompare(b.label)), []);

    const addressField = (field: keyof Location, label: string, extra: Record<string, unknown> = {}) => (
        <TextInput
            className={classes.field}
            label={label}
            value={form.values[field] as string}
            error={form.errors[`location_details.${field}`]}
            onChange={(event) => {
                form.setFieldValue(field, event.currentTarget.value);
                form.clearFieldError(`location_details.${field}`);
            }}
            {...extra}
        />
    );

    return (
        <SettingsCard
            id="location-settings"
            className={extra.anchored}
            title={t({message: 'Location', context: 'place'})}
            subtitle={t`Shown on the event page and on tickets.`}
        >
            <ToggleRow
                label={t`This is an online event`}
                hint={t`No address: the connection details are given once the order is paid.`}
                checked={form.values.is_online_event}
                onChange={(checked) => choose('is_online_event', checked)}
            />

            {form.values.is_online_event && (
                <Editor
                    className={`${classes.description} ${extra.editor}`}
                    editorType="simple"
                    label={t`Connection Details`}
                    description={t`Shown on the order summary and the tickets, once the order is paid.`}
                    value={form.values.online_event_connection_details}
                    error={form.errors.online_event_connection_details as string | undefined}
                    onChange={(value) => form.setFieldValue('online_event_connection_details', value)}
                    onBlur={() => commit('online_event_connection_details')}
                />
            )}

            {!form.values.is_online_event && (
                <>
                    <div className={classes.fields} onBlur={groupBlur(ADDRESS)}>
                        <div className={classes.fieldsSpan}>
                            {addressField('venue_name', t`Name of the place`, {maxLength: 255, placeholder: t`E.g.: Mont Sainte-Anne`})}
                        </div>
                        <div className={classes.fieldsSpan}>{addressField('address_line_1', t`Address`, {maxLength: 255})}</div>
                        <div className={classes.fieldsSpan}>
                            {addressField('address_line_2', t`Apartment, suite or office (optional)`, {maxLength: 255})}
                        </div>
                        {addressField('city', t`City`, {maxLength: 85})}
                        {addressField('zip_or_postal_code', t`Postal code`, {maxLength: 85})}
                        {addressField('state_or_region', t`Province`, {maxLength: 85})}
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
                                form.clearFieldError('location_details.country');
                            }}
                        />
                    </div>
                    <p className={classes.softHint}>{t`A place's name is enough. A street address also needs its city, postal code and country.`}</p>
                    <TextInput
                        className={classes.field}
                        type="url"
                        label={t`Map link (optional)`}
                        description={t`Without a link, the address opens in Google Maps.`}
                        placeholder="https://"
                        {...form.getInputProps('maps_url')}
                        onBlur={() => commit('maps_url')}
                    />
                </>
            )}
        </SettingsCard>
    );
};
