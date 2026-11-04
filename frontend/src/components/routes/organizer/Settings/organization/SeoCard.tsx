import {useRef} from "react";
import {t} from "@lingui/macro";
import {Textarea, TextInput} from "@mantine/core";
import {useForm} from "@mantine/form";
import {IdParam, Organizer, OrganizerSettings} from "../../../../../types.ts";
import {useUpdateOrganizerSettings} from "../../../../../mutations/useUpdateOrganizerSettings.ts";
import {organizerHomepageUrl} from "../../../../../utilites/urlHelper.ts";
import {useSectionAutosave} from "../../../../layouts/AppLayout/PageStatus.tsx";
import {SettingsCard, showServerErrors} from "../SettingsUi.tsx";
import {GooglePreview} from "../GooglePreview.tsx";
import classes from "../Settings.module.scss";

type Seo = Required<Pick<OrganizerSettings, 'seo_title' | 'seo_description' | 'seo_keywords'>>;

const fromSettings = (settings: OrganizerSettings): Seo => ({
    seo_title: settings.seo_title ?? '',
    seo_description: settings.seo_description ?? '',
    seo_keywords: settings.seo_keywords ?? '',
});

// « Référencement (Google) ». The pages are always indexed: no choice about it any more.
export const SeoCard = ({organizerId, organizer, settings}: {
    organizerId: IdParam,
    organizer: Organizer,
    settings: OrganizerSettings,
}) => {
    const updateSettings = useUpdateOrganizerSettings();
    const form = useForm<Seo>({initialValues: fromSettings(settings)});
    const saved = useRef<Seo>(fromSettings(settings));

    const queue = useSectionAutosave<Seo>('seo', (changes) => updateSettings.mutateAsync({
        organizerId,
        organizerSettings: changes,
    }), {
        onSaved: (changes) => Object.entries(changes).forEach(([field, value]) => {
            saved.current = {...saved.current, [field]: value};
            form.clearFieldError(field);
        }),
        onFailed: (error) => showServerErrors(form, error),
    });

    const commit = (field: keyof Seo) => {
        if (form.values[field].trim() !== saved.current[field].trim()) {
            queue({[field]: form.values[field].trim()});
        }
    };

    // The same fallbacks as the page itself (OrganizerDocumentHead).
    // eslint-disable-next-line lingui/no-unlocalized-strings
    const defaultTitle = `${organizer.name} - Events`;
    // eslint-disable-next-line lingui/no-unlocalized-strings
    const defaultDescription = `Discover upcoming events by ${organizer.name}.`;

    return (
        <SettingsCard title={t`Search engines (Google)`} subtitle={t`How your page shows in Google and when it is shared.`}>
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
                minRows={2}
                maxLength={1000}
                {...form.getInputProps('seo_description')}
                onBlur={() => commit('seo_description')}
            />
            <TextInput
                className={classes.field}
                label={t`Keywords`}
                description={t`Separated by commas.`}
                maxLength={255}
                {...form.getInputProps('seo_keywords')}
                onBlur={() => commit('seo_keywords')}
            />
            <GooglePreview
                url={organizerHomepageUrl(organizer)}
                title={form.values.seo_title.trim() || defaultTitle}
                description={form.values.seo_description.trim() || defaultDescription}
            />
        </SettingsCard>
    );
};
