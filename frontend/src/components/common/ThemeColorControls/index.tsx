import {ColorInput, SegmentedControl, Stack, Text, Group, Tooltip} from "@mantine/core";
import {t} from "@lingui/macro";
import {HomepageThemeSettings} from "../../../types.ts";
import {detectMode, getAccentReadability, getDefaultThemeSettings} from "../../../utilites/themeUtils.ts";
import {IconSun, IconMoon, IconEyeCheck, IconEyeExclamation, IconEyeOff} from "@tabler/icons-react";
import {useEffect, useMemo} from "react";

interface ThemeColorControlsProps {
    values: Partial<HomepageThemeSettings>;
    onChange: (values: Partial<HomepageThemeSettings>) => void;
    showBackgroundType?: boolean;
    disabled?: boolean;
}

// Sur les pages publiques, seul l'accent suit l'organisateur (le creme et les cartes de
// Dehors restent): c'est lui qu'on juge, en texte, en icones et en fond de bouton.
export const AccentReadabilityNote = ({accent}: { accent?: string }) => {
    const readability = useMemo(
        () => getAccentReadability(accent || getDefaultThemeSettings().accent),
        [accent],
    );

    return (
        <Group gap={6} style={{ minHeight: 20 }}>
            {readability === 'unreadable' && (
                <Tooltip label={t`Text and icons in the accent color barely stand out on the cream page. Pick a darker or more saturated color.`} multiline w={240}>
                    <Group gap={6} wrap="nowrap" style={{ cursor: 'help' }}>
                        <IconEyeOff size={30} color="var(--mantine-color-red-7)" />
                        <Text size="xs" fw={700} c="red.7">{t`Unreadable: text and icons in this color disappear on the page`}</Text>
                    </Group>
                </Tooltip>
            )}
            {readability === 'poor' && (
                <Tooltip label={t`Text and icons in the accent color barely stand out on the cream page. Pick a darker or more saturated color.`} multiline w={240}>
                    <Group gap={6} style={{ cursor: 'help' }}>
                        <IconEyeExclamation size={30} color="var(--mantine-color-yellow-6)" />
                        <Text size="xs" c="yellow.7">{t`Text may be hard to read`}</Text>
                    </Group>
                </Tooltip>
            )}
            {readability === 'good' && (
                <Group gap={6}>
                    <IconEyeCheck size={30} color="var(--mantine-color-teal-6)" />
                    <Text size="xs" c="dimmed">{t`Good readability`}</Text>
                </Group>
            )}
        </Group>
    );
};

export const ThemeColorControls = ({
    values,
    onChange,
    disabled = false,
}: ThemeColorControlsProps) => {
    const handleAccentChange = (accent: string) => {
        onChange({...values, accent});
    };

    const handleBackgroundChange = (background: string) => {
        const newMode = detectMode(background);
        onChange({...values, background, mode: newMode});
    };

    const handleModeChange = (mode: string) => {
        onChange({...values, mode: mode as 'light' | 'dark'});
    };

    useEffect(() => {
        if (values.background && !values.mode) {
            const detectedMode = detectMode(values.background);
            onChange({...values, mode: detectedMode});
        }
    }, [values.background]);

    const currentMode = values.mode || 'light';

    return (
        <Stack gap="md">
            <ColorInput
                format="hexa"
                label={t`Accent Color`}
                description={t`The primary brand color used for buttons and highlights`}
                size="sm"
                value={values.accent || '#8b5cf6'}
                onChange={handleAccentChange}
                disabled={disabled}
            />

            <ColorInput
                format="hexa"
                label={t`Background Color`}
                description={t`The background color of the page. When using cover image, this is applied as an overlay.`}
                size="sm"
                value={values.background || '#f5f3ff'}
                onChange={handleBackgroundChange}
                disabled={disabled}
            />

            <div>
                <Text size="sm" fw={500} mb={4}>{t`Color Mode`}</Text>
                <Text size="xs" c="dimmed" mb={8}>
                    {t`Automatically detected based on background color, but can be overridden`}
                </Text>
                <SegmentedControl
                    fullWidth
                    value={currentMode}
                    onChange={handleModeChange}
                    disabled={disabled}
                    data={[
                        {
                            label: (
                                <Group gap={6} justify="center">
                                    <IconSun size={16}/>
                                    <span>{t`Light`}</span>
                                </Group>
                            ),
                            value: 'light',
                        },
                        {
                            label: (
                                <Group gap={6} justify="center">
                                    <IconMoon size={16}/>
                                    <span>{t`Dark`}</span>
                                </Group>
                            ),
                            value: 'dark',
                        },
                    ]}
                />
            </div>

            <AccentReadabilityNote accent={values.accent}/>
        </Stack>
    );
};

export default ThemeColorControls;
