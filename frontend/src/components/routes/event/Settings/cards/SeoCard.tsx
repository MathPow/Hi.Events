import {t} from "@lingui/macro";
import {Textarea, TextInput} from "@mantine/core";
import {Event, EventSettings, IdParam} from "../../../../../types.ts";
import {useUpdateEventSettings} from "../../../../../mutations/useUpdateEventSettings.ts";
import {eventHomepageUrl} from "../../../../../utilites/urlHelper.ts";
import {intlLocale} from "../../../../../utilites/intlLocale.ts";
import {SettingsCard} from "../../../organizer/Settings/SettingsUi.tsx";
import {GooglePreview} from "../../../organizer/Settings/GooglePreview.tsx";
import {useAutosaveForm} from "../useAutosaveForm.ts";
import {HINT_UNDER_FIELD} from "../fieldParts.tsx";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

type Seo = Required<Pick<EventSettings, 'seo_title' | 'seo_description' | 'seo_keywords'>>;

const plainText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// « Référencement (Google) », like the organizer's. The event pages are always indexed: no choice about it.
export const SeoCard = ({eventId, event, settings}: { eventId: IdParam, event: Event, settings: EventSettings }) => {
    const updateSettings = useUpdateEventSettings();
    const {form, commit} = useAutosaveForm<Seo>({
        key: 'seo',
        initialValues: {
            seo_title: settings.seo_title ?? '',
            seo_description: settings.seo_description ?? '',
            seo_keywords: settings.seo_keywords ?? '',
        },
        save: (changes) => updateSettings.mutateAsync({
            eventId,
            eventSettings: {
                ...Object.fromEntries(Object.entries(changes).map(([field, value]) => [field, (value as string).trim() || null])),
                allow_search_engine_indexing: true,
            },
        }),
    });

    // The same fallbacks as the page itself (EventDocumentHead).
    const organizerName = event.organizer?.name;
    const defaultTitle = organizerName ? `${event.title} | ${organizerName}` : event.title;
    const defaultDescription = event.description_preview || plainText(event.description ?? '').slice(0, 160);
    const title = form.values.seo_title.trim();
    const date = event.start_date
        ? new Intl.DateTimeFormat(intlLocale(), {day: 'numeric', month: 'short', year: 'numeric', timeZone: event.timezone})
            .format(new Date(event.start_date))
        : undefined;

    return (
        <SettingsCard
            id="seo-settings"
            className={extra.anchored}
            title={t`Search engines (Google)`}
            subtitle={t`How the event page shows in Google and when it is shared.`}
        >
            <TextInput
                className={classes.field}
                label={t`Title`}
                placeholder={defaultTitle}
                maxLength={255}
                {...form.getInputProps('seo_title')}
                onBlur={() => commit('seo_title')}
            />
            <Textarea
                className={classes.field}
                label={t`Description`}
                placeholder={defaultDescription}
                autosize
                minRows={3}
                maxLength={255}
                {...form.getInputProps('seo_description')}
                onBlur={() => commit('seo_description')}
            />
            <TextInput
                className={classes.field}
                label={t`Keywords`}
                description={t`Separated by commas.`}
                maxLength={255}
                {...HINT_UNDER_FIELD}
                {...form.getInputProps('seo_keywords')}
                onBlur={() => commit('seo_keywords')}
            />
            <GooglePreview
                url={eventHomepageUrl(event)}
                title={title ? (organizerName ? `${title} | ${organizerName}` : title) : defaultTitle}
                description={form.values.seo_description.trim() || defaultDescription}
                date={date}
            />
        </SettingsCard>
    );
};
