import {useMemo} from "react";
import {t} from "@lingui/macro";
import {Select, TextInput} from "@mantine/core";
import {Event, IdParam} from "../../../../../types.ts";
import {useUpdateEvent} from "../../../../../mutations/useUpdateEvent.ts";
import {utcToTz} from "../../../../../utilites/dates.ts";
import {timezoneLabel} from "../../../../../utilites/timezoneLabel.ts";
import {timezones} from "../../../../../../data/timezones.ts";
import {CATEGORY_OF_TYPE, EVENT_TYPES, eventTypeLabel, typeOfCategory} from "../../../../../constants/eventTypes.ts";
import {Editor} from "../../../../common/Editor";
import {DateTimeField} from "../../../../common/DateTimeField";
import {PillChoice, SettingsCard} from "../../../organizer/Settings/SettingsUi.tsx";
import {htmlOrNull, useAutosaveForm} from "../useAutosaveForm.ts";
import {fieldIcon, FIELD_CHEVRON} from "../fieldParts.tsx";
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

    const timezoneOptions = useMemo(() => timezones.map(timezone => ({
        value: timezone,
        label: timezoneLabel(timezone),
    })), []);

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
                        label={t`Event name`}
                        maxLength={150}
                        placeholder={t`E.g.: Hare Race · 10 km`}
                        {...form.getInputProps('title')}
                        onBlur={() => commit('title')}
                    />
                </div>
                <div className={`${classes.fieldsSpan} ${extra.fieldGroup}`}>
                    <p className={classes.fieldLabel}>{t`Category`}</p>
                    {/* Sport, Entrepreneuriat, Social, Autre, as in « Créer un événement »: a former category
                        (Musique, Technologie…) shows as the type it belongs to. */}
                    <PillChoice
                        label={t`Category`}
                        value={form.values.category ? CATEGORY_OF_TYPE[typeOfCategory(form.values.category)] : null}
                        options={EVENT_TYPES.map(type => ({value: CATEGORY_OF_TYPE[type], label: eventTypeLabel(type)}))}
                        onChange={(value) => choose('category', value)}
                    />
                    <p className={classes.hint}>{t`Used for the Directory filters.`}</p>
                </div>
                <DateTimeField
                    label={t({message: 'Start', context: 'event date'})}
                    withWeekday
                    value={form.values.start_date}
                    error={form.errors.start_date}
                    onChange={(value) => choose('start_date', value)}
                />
                <DateTimeField
                    label={t({message: 'End', context: 'event date'})}
                    withWeekday
                    clearable
                    value={form.values.end_date}
                    error={form.errors.end_date}
                    onChange={(value) => choose('end_date', value)}
                />
                <div className={classes.fieldsSpan}>
                    <Select
                        className={classes.field}
                        label={t`Timezone`}
                        searchable
                        allowDeselect={false}
                        data={timezoneOptions}
                        leftSection={fieldIcon('globe')}
                        leftSectionWidth={48}
                        {...FIELD_CHEVRON}
                        value={form.values.timezone || null}
                        error={form.errors.timezone}
                        onChange={(value) => value && choose('timezone', value)}
                    />
                </div>
                <div className={classes.fieldsSpan}>
                    <Editor
                        className={`${classes.description} ${extra.editor}`}
                        editorType="minimal"
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
