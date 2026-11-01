import {useEffect, useState} from "react";
import {t} from "@lingui/macro";
import {ColorPicker, TextInput} from "@mantine/core";
import {AccentReadabilityNote} from "../../../common/ThemeColorControls";
import {toHexColor} from "../../../../utilites/themeUtils.ts";
import classes from "./OrganizerHomepageDesigner.module.scss";

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const sameColor = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// « #FA7853 » => [250, 120, 83]; the alpha of an 8-digit code is left out.
const toRgb = (hex: string): [number, number, number] => {
    const full = toHexColor(hex) ?? '#000000';
    return [1, 3, 5].map(index => parseInt(full.slice(index, index + 2), 16) || 0) as [number, number, number];
};

const toHex = (rgb: number[]) => '#' + rgb.map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase();

interface AccentSectionProps {
    accent: string;
    onChange: (accent: string) => void;
    disabled?: boolean;
    // The readability on the cream public pages (not on the white tickets).
    readability?: boolean;
}

/**
 * The accent color (Ma page, the event page, the tickets): a color picker, no suggested colors,
 * then its HEX code and its R, V, B values, to type or paste (Figma « Admin · Ma page »).
 */
export const AccentSection = ({accent, onChange, disabled, readability = true}: AccentSectionProps) => {
    const [code, setCode] = useState(accent.toUpperCase());
    const [channels, setChannels] = useState<string[]>(toRgb(accent).map(String));

    useEffect(() => {
        if (!sameColor(code, accent)) {
            setCode(accent.toUpperCase());
        }
        if (toHex(channels.map(Number)) !== (toHexColor(accent) ?? '').toUpperCase()) {
            setChannels(toRgb(accent).map(String));
        }
    }, [accent]);

    const changeChannel = (index: number, value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 3);
        const next = channels.map((current, position) => position === index ? digits : current);
        setChannels(next);
        if (next.every(item => item !== '' && Number(item) <= 255)) {
            onChange(toHex(next.map(Number)));
        }
    };

    const channelLabels = [t({message: 'R', context: 'red'}), t({message: 'G', context: 'green'}), t({message: 'B', context: 'blue'})];
    const channelNames = [t`Red`, t`Green`, t`Blue`];

    return (
        <>
            <div className={classes.picker} data-disabled={disabled || undefined}>
                <ColorPicker
                    format="hex"
                    fullWidth
                    size="lg"
                    value={toHexColor(accent) ?? accent}
                    onChange={(color) => onChange(color.toUpperCase())}
                    classNames={{saturation: classes.pickerSaturation, slider: classes.pickerSlider}}
                    aria-label={t`Accent color`}
                />
            </div>

            <div className={classes.codeRow}>
                <TextInput
                    className={classes.codeField}
                    aria-label={t`Color code`}
                    value={code}
                    maxLength={9}
                    disabled={disabled}
                    spellCheck={false}
                    leftSection={<span className={classes.codeSwatch} style={{background: accent}} aria-hidden/>}
                    leftSectionWidth={52}
                    classNames={{input: classes.codeInput}}
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
                {channels.map((value, index) => (
                    <label key={index} className={classes.channel} data-disabled={disabled || undefined}>
                        <input
                            value={value}
                            inputMode="numeric"
                            maxLength={3}
                            disabled={disabled}
                            aria-label={channelNames[index]}
                            aria-invalid={value === '' || Number(value) > 255 || undefined}
                            onChange={(event) => changeChannel(index, event.currentTarget.value)}
                            onBlur={() => setChannels(toRgb(accent).map(String))}
                        />
                        <span aria-hidden>{channelLabels[index]}</span>
                    </label>
                ))}
            </div>

            {readability && <AccentReadabilityNote accent={accent}/>}
        </>
    );
};
