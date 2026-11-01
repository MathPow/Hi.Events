import {useRef, useState} from "react";
import {t} from "@lingui/macro";
import {Menu, TextInput} from "@mantine/core";
import {IdParam, OrganizerSettings} from "../../../../../types.ts";
import {useUpdateOrganizerSettings} from "../../../../../mutations/useUpdateOrganizerSettings.ts";
import {socialMediaConfig} from "../../../../../constants/socialMediaConfig.ts";
import {useSectionAutosave} from "../../../../layouts/AppLayout/PageStatus.tsx";
import {SOCIAL_PLATFORMS, socialPlatformIcon, socialPlatformLabel} from "../../OrganizerHomepageDesigner/socialPlatforms.ts";
import {serverMessage, SettingsCard} from "../SettingsUi.tsx";
import classes from "../Settings.module.scss";

interface SocialRow {
    platform: string;
    handle: string;
}

// The filled networks, in the order chosen on « Ma page » (the others follow).
const fromSettings = (settings: OrganizerSettings): SocialRow[] => {
    const handles = (settings.social_media_handles ?? {}) as Record<string, string | undefined>;
    const order = [...(settings.social_media_layout ?? []).map(({platform}) => platform), ...Object.keys(handles)];

    return [...new Set(order)]
        .filter(platform => handles[platform]?.trim())
        .map(platform => ({platform, handle: handles[platform] as string}));
};

// « https://www.instagram.com/sulpace/ » pasted whole becomes « sulpace ».
const normalizeHandle = (platform: string, value: string) => {
    const trimmed = value.trim();
    const baseUrl = socialMediaConfig[platform as keyof typeof socialMediaConfig]?.baseUrl;
    if (!baseUrl || baseUrl === '#') {
        return trimmed;
    }
    const prefix = baseUrl.replace(/^https?:\/\/(www\.)?/i, '').toLowerCase();
    const bare = trimmed.replace(/^https?:\/\/(www\.)?/i, '');

    return bare.toLowerCase().startsWith(prefix)
        ? bare.slice(prefix.length).replace(/\/+$/, '')
        : trimmed;
};

type HandleChanges = Record<string, string | null>;

// « Réseaux sociaux »: only the networks in use; their order and visibility are set on « Ma page ».
export const SocialLinksCard = ({organizerId, settings}: { organizerId: IdParam, settings: OrganizerSettings }) => {
    const updateSettings = useUpdateOrganizerSettings();
    const [rows, setRows] = useState<SocialRow[]>(() => fromSettings(settings));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [added, setAdded] = useState<string | null>(null);
    const saved = useRef<Record<string, string>>(Object.fromEntries(fromSettings(settings).map(row => [row.platform, row.handle])));
    const available = SOCIAL_PLATFORMS.filter(platform => !rows.some(row => row.platform === platform));

    const queue = useSectionAutosave<HandleChanges>('social', (changes) => updateSettings.mutateAsync({
        organizerId,
        organizerSettings: changes,
    }), {
        onSaved: (changes) => {
            Object.entries(changes).forEach(([field, value]) => {
                saved.current[field.replace(/_handle$/, '')] = value ?? '';
            });
            setErrors(current => Object.fromEntries(Object.entries(current).filter(([field]) => !(field in changes))));
        },
        onFailed: (error: any) => {
            const fieldErrors = error?.response?.data?.errors as Record<string, string[]> | undefined;
            if (fieldErrors) {
                setErrors(Object.fromEntries(Object.entries(fieldErrors).map(([field, messages]) => [field, serverMessage(messages)])));
            }
        },
    });

    const setHandle = (platform: string, handle: string) =>
        setRows(current => current.map(row => row.platform === platform ? {...row, handle} : row));

    const commit = (platform: string, handle: string) => {
        const value = normalizeHandle(platform, handle);
        if (value !== handle) {
            setHandle(platform, value);
        }
        if (value !== (saved.current[platform] ?? '')) {
            queue({[`${platform}_handle`]: value || null});
        }
    };

    const remove = (platform: string) => {
        setRows(current => current.filter(row => row.platform !== platform));
        if (saved.current[platform]) {
            queue({[`${platform}_handle`]: null});
        }
    };

    const add = (platform: string) => {
        setRows(current => [...current, {platform, handle: ''}]);
        setAdded(platform);
    };

    return (
        <SettingsCard title={t`Social networks`} subtitle={t`Shown on your page. Their order is set in My page.`}>
            {rows.map(({platform, handle}) => {
                const Icon = socialPlatformIcon(platform);
                const label = socialPlatformLabel(platform);

                return (
                    <div key={platform} className={classes.socialRow}>
                        <span className={classes.pastille} title={label}>
                            <Icon size={20} stroke={2}/>
                        </span>
                        <TextInput
                            className={classes.field}
                            aria-label={label}
                            placeholder={t`Username or link`}
                            value={handle}
                            maxLength={255}
                            autoFocus={added === platform}
                            error={errors[`${platform}_handle`]}
                            onChange={(event) => setHandle(platform, event.currentTarget.value)}
                            onBlur={(event) => commit(platform, event.currentTarget.value)}
                        />
                        <button
                            type="button"
                            className={classes.iconButton}
                            aria-label={t`Remove ${label}`}
                            title={t`Remove ${label}`}
                            onClick={() => remove(platform)}
                        >
                            <img src="/interface/admin/parametres/corbeille.svg" alt=""/>
                        </button>
                    </div>
                );
            })}

            {available.length > 0 && (
                <Menu position="bottom-start">
                    <Menu.Target>
                        <button type="button" className={classes.textButton}>
                            <img src="/interface/admin/parametres/plus-accent.svg" alt=""/>
                            {t`Add a network`}
                        </button>
                    </Menu.Target>
                    <Menu.Dropdown className={classes.platformMenu}>
                        {available.map(platform => {
                            const Icon = socialPlatformIcon(platform);
                            return (
                                <Menu.Item key={platform} leftSection={<Icon size={18} stroke={2}/>}
                                           onClick={() => add(platform)}>
                                    {socialPlatformLabel(platform)}
                                </Menu.Item>
                            );
                        })}
                    </Menu.Dropdown>
                </Menu>
            )}
        </SettingsCard>
    );
};
