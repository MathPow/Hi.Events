import {useEffect, useRef, useState} from "react";
import {t} from "@lingui/macro";
import {ActionIcon, Autocomplete, Loader, Tooltip} from "@mantine/core";
import {IconMapPin} from "@tabler/icons-react";
import {LatLng} from "../../../../utilites/course/geo.ts";
import {PlaceResult, searchPlaces} from "../../../../utilites/course/places.ts";
import {getClientLocale} from "../../../../locales.ts";
import classes from "./Courses.module.scss";

export interface Place {
    label: string;
    position: LatLng;
}

interface PlaceInputProps {
    label: string;
    placeholder: string;
    value: Place | null;
    near?: LatLng;
    picking: boolean;
    onPick: () => void;
    onChange: (place: Place | null) => void;
}

/** An address, suggested as it is typed, or a point picked on the map with the pin button. */
export const PlaceInput = ({label, placeholder, value, near, picking, onPick, onChange}: PlaceInputProps) => {
    const [text, setText] = useState(value?.label ?? '');
    const [results, setResults] = useState<PlaceResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchedFor, setSearchedFor] = useState('');
    const typed = useRef(false);

    useEffect(() => {
        // Emptied by typing: the text being typed stays.
        if (value === null && typed.current) {
            return;
        }
        typed.current = false;
        setText(value?.label ?? '');
    }, [value]);

    useEffect(() => {
        const query = text.trim();
        if (!typed.current || query.length < 3) {
            setResults([]);
            setSearching(false);
            setSearchedFor('');
            return;
        }

        let cancelled = false;
        const timer = window.setTimeout(async () => {
            setSearching(true);
            const found = await searchPlaces(query, near, getClientLocale());
            if (!cancelled) {
                setResults(found);
                setSearching(false);
                setSearchedFor(query);
            }
        }, 350);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            setSearching(false);
        };
    }, [text, near]);

    const choose = (labelText: string) => {
        const place = results.find((result) => result.label === labelText);
        if (place) {
            typed.current = false;
            onChange(place);
        }
    };

    return (
        <Autocomplete
            className={classes.placeInput}
            label={label}
            placeholder={placeholder}
            value={text}
            data={[...new Set(results.map((result) => result.label))]}
            filter={({options}) => options}
            onChange={(next) => {
                typed.current = true;
                setText(next);
                // The place shown no longer matches the text: it isn't the start any more.
                if (value) {
                    onChange(null);
                }
            }}
            onOptionSubmit={choose}
            description={!searching && searchedFor !== '' && searchedFor === text.trim() && results.length === 0
                ? t`No address found. Try another spelling, or choose on the map.`
                : undefined}
            inputWrapperOrder={['label', 'input', 'description']}
            rightSectionWidth={searching ? 64 : 44}
            rightSectionPointerEvents="all"
            rightSection={(
                <>
                    {searching && <Loader size={14}/>}
                    <Tooltip label={t`Choose on the map`} withArrow>
                        <ActionIcon
                            className={classes.pickButton}
                            data-active={picking || undefined}
                            variant="subtle"
                            size={34}
                            aria-label={t`Choose on the map`}
                            aria-pressed={picking}
                            onClick={onPick}
                        >
                            <IconMapPin size={20}/>
                        </ActionIcon>
                    </Tooltip>
                </>
            )}
            comboboxProps={{withinPortal: true}}
        />
    );
};
