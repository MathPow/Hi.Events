import {t} from "@lingui/macro";
import {Select, TextInput} from "@mantine/core";
import {Event, IdParam} from "../../../../../types.ts";
import {useUpdateEvent} from "../../../../../mutations/useUpdateEvent.ts";
import {utcToTz} from "../../../../../utilites/dates.ts";
import {timezones} from "../../../../../../data/timezones.ts";
import {EventCategories} from "../../../../../constants/eventCategories.ts";
import {Editor} from "../../../../common/Editor";
import {PillChoice, SettingsCard} from "../../../organizer/Settings/SettingsUi.tsx";
import {htmlOrNull, useAutosaveForm} from "../useAutosaveForm.ts";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

interface Details {
    title: string;
    category: string;
    description: string;
    start_date: string;
    end_date: string;
    timezone: string;
    currency: string;
}

const fromEvent = (event: Event): Details => ({
    title: event.title ?? '',
    category: event.category ?? '',
    description: event.description ?? '',
    start_date: utcToTz(event.start_date, event.timezone) ?? '',
    end_date: utcToTz(event.end_date, event.timezone) ?? '',
    timezone: event.timezone ?? '',
    currency: event.currency ?? '',
});

// « Infos de base »: the event itself, saved whole (name, category, description, dates, timezone).
export const DetailsCard = ({eventId, event}: { eventId: IdParam, event: Event }) => {
    const updateEvent = useUpdateEvent();
    const {form, commit, choose} = useAutosaveForm<Details>({
        key: 'event-details',
        initialValues: fromEvent(event),
        html: ['description'],
        save: (_, values) => updateEvent.mutateAsync({
            eventId,
            eventData: {
                title: values.title.trim(),
                category: values.category || null,
                description: htmlOrNull(values.description),
                start_date: values.start_date,
                end_date: values.end_date || null,
                timezone: values.timezone,
                currency: values.currency,
            } as Partial<Event>,
        }),
    });

    const dateField = (field: 'start_date' | 'end_date', label: string) => (
        <TextInput
            className={classes.field}
            type="datetime-local"
            label={label}
            {...form.getInputProps(field)}
            onBlur={() => commit(field)}
        />
    );

    return (
        <SettingsCard
            id="event-details"
            full
            className={extra.anchored}
            title={t`Basic info`}
            subtitle={t`Shown on the event page, on tickets and in emails.`}
        >
            <div className={classes.fields}>
                <div className={classes.fieldsSpan}>
                    <TextInput
                        className={classes.field}
                        label={t`Name`}
                        maxLength={150}
                        placeholder={t`E.g.: Hare Race · 10 km`}
                        {...form.getInputProps('title')}
                        onBlur={() => commit('title')}
                    />
                </div>
                <div className={`${classes.fieldsSpan} ${extra.fieldGroup}`}>
                    <p className={classes.fieldLabel}>{t`Category`}</p>
                    <PillChoice
                        label={t`Category`}
                        value={form.values.category || null}
                        options={EventCategories.map(category => ({value: category.id, label: `${category.emoji} ${category.name}`}))}
                        onChange={(value) => choose('category', value)}
                    />
                </div>
                {dateField('start_date', t`Start Date`)}
                {dateField('end_date', t`End Date`)}
                <Select
                    className={classes.field}
                    label={t`Timezone`}
                    searchable
                    allowDeselect={false}
                    data={timezones}
                    value={form.values.timezone || null}
                    error={form.errors.timezone}
                    onChange={(value) => value && choose('timezone', value)}
                />
                <div className={classes.fieldsSpan}>
                    <Editor
                        className={`${classes.description} ${extra.editor}`}
                        label={t`Description`}
                        value={form.values.description}
                        error={form.errors.description as string | undefined}
                        onChange={(value) => form.setFieldValue('description', value)}
                        onBlur={() => commit('description')}
                    />
                </div>
            </div>
        </SettingsCard>
    );
};
