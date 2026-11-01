import {useEffect, useState} from "react";
import {t} from "@lingui/macro";
import {ColorPicker, TextInput} from "@mantine/core";
import {AccentReadabilityNote} from "../../../common/ThemeColorControls";
import {toHexColor} from "../../../../utilites/themeUtils.ts";
import classes from "./OrganizerHomepageDesigner.module.scss";

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const sameColor = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

interface AccentSectionProps {
    accent: string;
    onChange: (accent: string) => void;
    disabled?: boolean;
    // The readability on the cream public pages (not on the white tickets).
    readability?: boolean;
}

/**
 * The accent color (Ma page, the event page, the tickets): a color picker, no suggested colors,
 * and its code to type or paste.
 */
export const AccentSection = ({accent, onChange, disabled, readability = true}: AccentSectionProps) => {
    const [code, setCode] = useState(accent.toUpperCase());

    useEffect(() => {
        if (!sameColor(code, accent)) {
            setCode(accent.toUpperCase());
        }
    }, [accent]);

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

            <TextInput
                className={classes.field}
                label={t`Color code`}
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

            {readability && <AccentReadabilityNote accent={accent}/>}
        </>
    );
};
