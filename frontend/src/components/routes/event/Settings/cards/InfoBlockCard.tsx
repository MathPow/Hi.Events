import {t} from "@lingui/macro";
import {TextInput} from "@mantine/core";
import {IconLink} from "@tabler/icons-react";
import {EventSettings, IdParam} from "../../../../../types.ts";
import {useUpdateEventSettings} from "../../../../../mutations/useUpdateEventSettings.ts";
import {
    DEFAULT_PRODUCT_INFO_ICON,
    getProductInfoIconLabels,
    PRODUCT_INFO_ICONS,
    ProductInfoIconKey,
} from "../../../../../constants/productInfoIcons.ts";
import {Editor} from "../../../../common/Editor";
import {SettingsCard} from "../../../organizer/Settings/SettingsUi.tsx";
import {htmlOrNull, useAutosaveForm} from "../useAutosaveForm.ts";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

interface InfoBlock {
    product_info_message: string;
    product_info_icon: string;
    product_info_button_text: string;
    product_info_button_url: string;
}

const BUTTON: (keyof InfoBlock)[] = ['product_info_button_text', 'product_info_button_url'];

// « Bloc d'information »: a message under the tickets (and, shorter, on the details step), with an
// optional button (a donation on another platform…).
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

    return (
        <SettingsCard
            id="information-block"
            full
            className={extra.anchored}
            title={t`Information block`}
            subtitle={t`Shown below the promo code field on the ticket selection, and in a compact version on the details step, just above the secure checkout notice. Use it to share important information or invite buyers to make an extra donation on another platform.`}
        >
            <Editor
                className={`${classes.description} ${extra.editor}`}
                editorType="simple"
                label={t`Message`}
                value={form.values.product_info_message}
                error={form.errors.product_info_message as string | undefined}
                onChange={(value) => form.setFieldValue('product_info_message', value)}
                onBlur={() => commit('product_info_message')}
            />

            <div className={extra.fieldGroup}>
                <p className={classes.fieldLabel}>{t`Icon`}</p>
                <div className={extra.iconChoices} role="radiogroup" aria-label={t`Icon`}>
                    {(Object.keys(PRODUCT_INFO_ICONS) as ProductInfoIconKey[]).map(key => {
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
                                <Icon size={20} stroke={1.75}/>
                            </button>
                        );
                    })}
                </div>
                <p className={classes.hint}>{t`Shown next to the message.`}</p>
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
                    leftSection={<IconLink size={16}/>}
                    {...form.getInputProps('product_info_button_url')}
                />
            </div>
            <p className={classes.softHint}>{t`Leave the button text and link empty to show the message without a button.`}</p>
        </SettingsCard>
    );
};
