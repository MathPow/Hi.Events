import {t} from "@lingui/macro";
import {TextInput} from "@mantine/core";
import {EventSettings, IdParam} from "../../../../../types.ts";
import {useUpdateEventSettings} from "../../../../../mutations/useUpdateEventSettings.ts";
import {
    DEFAULT_PRODUCT_INFO_ICON,
    getProductInfoIconLabels,
    PRODUCT_INFO_ICON_CHOICES,
    PRODUCT_INFO_ICONS,
    ProductInfoIconKey,
} from "../../../../../constants/productInfoIcons.ts";
import {Editor} from "../../../../common/Editor";
import {SettingsCard} from "../../../organizer/Settings/SettingsUi.tsx";
import {htmlOrNull, useAutosaveForm} from "../useAutosaveForm.ts";
import {fieldIcon} from "../fieldParts.tsx";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

interface InfoBlock {
    product_info_message: string;
    product_info_icon: string;
    product_info_button_text: string;
    product_info_button_url: string;
}

const BUTTON: (keyof InfoBlock)[] = ['product_info_button_text', 'product_info_button_url'];

// « Bloc d'info »: a message under the tickets (and, shorter, on the details step), with an optional
// button (a donation on another platform…).
export const InfoBlockCard = ({eventId, settings}: { eventId: IdParam, settings: EventSettings }) => {
    const updateSettings = useUpdateEventSettings();
    const {form, commit, choose, groupBlur} = useAutosaveForm<InfoBlock>({
        key: 'information-block',
        initialValues: {
            product_info_message: settings.product_info_message ?? '',
            product_info_icon: settings.product_info_icon || DEFAULT_PRODUCT_INFO_ICON,
            product_info_button_text: settings.product_info_button_text ?? '',
            product_info_button_url: settings.product_info_button_url ?? '',
        },
        html: ['product_info_message'],
        save: (changes) => updateSettings.mutateAsync({
            eventId,
            eventSettings: Object.fromEntries(Object.entries(changes).map(([field, value]) => [
                field,
                field === 'product_info_message' ? htmlOrNull(value as string) : ((value as string).trim() || null),
            ])),
        }),
    });

    const iconLabels = getProductInfoIconLabels();
    const current = form.values.product_info_icon as ProductInfoIconKey;
    // An icon chosen before the short list stays there until another one is picked.
    const choices = PRODUCT_INFO_ICON_CHOICES.includes(current) || !PRODUCT_INFO_ICONS[current]
        ? PRODUCT_INFO_ICON_CHOICES
        : [current, ...PRODUCT_INFO_ICON_CHOICES];

    return (
        <SettingsCard
            id="information-block"
            full
            className={extra.anchored}
            title={t`Info block`}
            subtitle={t`A box under the tickets for important information or a link (e.g. a donation).`}
        >
            <Editor
                className={`${classes.description} ${extra.plainEditor}`}
                editorType="plain"
                label={t`Message`}
                value={form.values.product_info_message}
                error={form.errors.product_info_message as string | undefined}
                onChange={(value) => form.setFieldValue('product_info_message', value)}
                onBlur={() => commit('product_info_message')}
            />

            <div className={extra.fieldGroup}>
                <p className={classes.fieldLabel}>{t`Icon`}</p>
                <div className={extra.iconChoices} role="radiogroup" aria-label={t`Icon`}>
                    {choices.map(key => {
                        const Icon = PRODUCT_INFO_ICONS[key];
                        return (
                            <button
                                key={key}
                                type="button"
                                role="radio"
                                aria-checked={form.values.product_info_icon === key}
                                aria-label={iconLabels[key]}
                                title={iconLabels[key]}
                                className={extra.iconChoice}
                                onClick={() => choose('product_info_icon', key)}
                            >
                                <Icon size={18} stroke={1.75}/>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className={classes.fields} onBlur={groupBlur(BUTTON)}>
                <TextInput
                    className={classes.field}
                    label={t`Button text`}
                    placeholder={t`e.g. Make a donation`}
                    maxLength={100}
                    {...form.getInputProps('product_info_button_text')}
                />
                <TextInput
                    className={classes.field}
                    label={t`Button link`}
                    placeholder="https://"
                    type="url"
                    leftSection={fieldIcon('lien-champ')}
                    leftSectionWidth={48}
                    {...form.getInputProps('product_info_button_url')}
                />
            </div>
            <p className={classes.hint}>{t`Without text or link, the message shows without a button.`}</p>
        </SettingsCard>
    );
};
