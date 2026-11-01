import {useEffect, useState} from "react";
import {t} from "@lingui/macro";
import {ColorPicker, Popover, TextInput} from "@mantine/core";
import {IconCheck} from "@tabler/icons-react";
import {AccentReadabilityNote} from "../../../common/ThemeColorControls";
import {isLightColor, toHexColor} from "../../../../utilites/themeUtils.ts";
import classes from "./OrganizerHomepageDesigner.module.scss";

// The 8 choices of the mockup: the Dehors orange first.
export const ACCENT_CHOICES = ['#FA7853', '#E5484D', '#F2B33D', '#5BAA6B', '#3E9C85', '#4E8DB3', '#8268B5', '#372721'];

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const sameColor = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const isDark = (color: string) => !isLightColor(toHexColor(color) ?? '#ffffff');

interface AccentSectionProps {
    accent: string;
    onChange: (accent: string) => void;
    disabled?: boolean;
}

export const AccentSection = ({accent, onChange, disabled}: AccentSectionProps) => {
    const [code, setCode] = useState(accent.toUpperCase());
    const [pickerOpen, setPickerOpen] = useState(false);
    const isCustom = !ACCENT_CHOICES.some(choice => sameColor(choice, accent));

    useEffect(() => {
        if (!sameColor(code, accent)) {
            setCode(accent.toUpperCase());
        }
    }, [accent]);

    const checkColor = (color: string) => isDark(color) ? 'var(--dehors-creme)' : 'var(--dehors-brun)';

    return (
        <>
            <div className={classes.swatches} role="radiogroup" aria-label={t`Accent color`}>
                {ACCENT_CHOICES.map(choice => {
                    const selected = sameColor(choice, accent);
                    return (
                        <button
                            key={choice}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={choice}
                            className={classes.swatch}
                            data-selected={selected || undefined}
                            data-dark={(selected && isDark(choice)) || undefined}
                            style={{background: choice}}
                            disabled={disabled}
                            onClick={() => onChange(choice)}
                        >
                            {selected && <IconCheck size={16} stroke={2.5} color={checkColor(choice)}/>}
                        </button>
                    );
                })}

                <Popover opened={pickerOpen} onChange={setPickerOpen} position="bottom-start" shadow="md">
                    <Popover.Target>
                        <button
                            type="button"
                            role="radio"
                            aria-checked={isCustom}
                            aria-label={t`Custom color`}
                            className={`${classes.swatch} ${classes.customSwatch}`}
                            data-selected={isCustom || undefined}
                            data-dark={(isCustom && isDark(accent)) || undefined}
                            style={isCustom ? {background: accent} : undefined}
                            disabled={disabled}
                            onClick={() => setPickerOpen(open => !open)}
                        >
                            {isCustom
                                ? <IconCheck size={16} stroke={2.5} color={checkColor(accent)}/>
                                : <img src="/interface/admin/ma-page/plus.svg" alt="" width={16} height={16}/>}
                        </button>
                    </Popover.Target>
                    <Popover.Dropdown>
                        <ColorPicker
                            format="hex"
                            value={toHexColor(accent) ?? accent}
                            onChange={(color) => onChange(color.toUpperCase())}
                        />
                    </Popover.Dropdown>
                </Popover>
            </div>

            <TextInput
                className={classes.field}
                label={t`Color code`}
                value={code}
                maxLength={9}
                disabled={disabled}
                spellCheck={false}
                onChange={(event) => {
                    const value = event.currentTarget.value.trim();
                    const withHash = value.startsWith('#') ? value : `#${value}`;
                    setCode(value.toUpperCase());
                    if (HEX_PATTERN.test(withHash)) {
                        onChange(withHash.toUpperCase());
                    }
                }}
                onBlur={() => setCode(accent.toUpperCase())}
                error={code && !HEX_PATTERN.test(code.startsWith('#') ? code : `#${code}`) ? t`Use a code like #FA7853` : undefined}
            />

            <AccentReadabilityNote accent={accent}/>
        </>
    );
};
