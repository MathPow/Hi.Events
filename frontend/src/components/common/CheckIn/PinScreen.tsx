import {ReactNode, useEffect, useRef, useState} from "react";
import {t} from "@lingui/macro";
import classes from "./Scanner.module.scss";

interface ListIntroProps {
    listName?: string;
    eventLine?: string;
    description?: string | null;
    children: ReactNode;
}

// The lock, the list's name, its event and what the staff should do: the first thing a phone sees.
export const ListIntro = ({listName, eventLine, description, children}: ListIntroProps) => (
    <div className={classes.intro}>
        <span className={classes.introLock}>
            <img src="/interface/admin/scanner/cadenas.svg" width={28} height={28} alt=""/>
        </span>
        <h1 className={classes.introTitle}>{listName}</h1>
        {eventLine && <p className={classes.introEvent}>{eventLine}</p>}
        {description && <p className={classes.introDescription}>{description}</p>}
        {children}
    </div>
);

interface PinScreenProps extends Omit<ListIntroProps, 'children'> {
    length?: number;
    hasFailed: boolean;
    // True once the PIN has been accepted; false clears the boxes.
    onSubmit: (pin: string) => Promise<boolean>;
}

/**
 * Figma « Scanner · Entrer le NIP » (555:3120): the phone's own number keyboard, no homemade one, and
 * the scanner opens at the last digit. The boxes only show what the real field underneath holds.
 */
export const PinScreen = ({listName, eventLine, description, length = 4, hasFailed, onSubmit}: PinScreenProps) => {
    const [pin, setPin] = useState('');
    const [refused, setRefused] = useState(hasFailed);
    const [checking, setChecking] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const size = Math.max(length, 4);

    useEffect(() => {
        input.current?.focus();
    }, []);

    useEffect(() => {
        if (pin.length !== size) {
            return;
        }
        setChecking(true);
        onSubmit(pin).then((accepted) => {
            setChecking(false);
            if (!accepted) {
                setRefused(true);
                setPin('');
                input.current?.focus();
            }
        });
    }, [pin, size]);

    return (
        <ListIntro listName={listName} eventLine={eventLine} description={description}>
            <label className={classes.pinLabel} htmlFor="scanner-pin">{t`Enter the scanner PIN`}</label>
            <div className={classes.pinBoxes} data-long={size > 6 || undefined}>
                {Array.from({length: size}, (_, index) => (
                    <span key={index} className={classes.pinBox} data-current={index === pin.length || undefined}>
                        {index < pin.length && <span className={classes.pinDot}/>}
                    </span>
                ))}
                <input
                    id="scanner-pin"
                    ref={input}
                    className={classes.pinInput}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={size}
                    value={pin}
                    disabled={checking}
                    onChange={(event) => {
                        setRefused(false);
                        setPin(event.currentTarget.value.replace(/\D/g, '').slice(0, size));
                    }}
                />
            </div>
            {refused
                ? <p className={classes.pinError} role="alert">{t`That PIN is not correct.`}</p>
                : <p className={classes.pinHint}>{t`The organizer gives you the PIN. The scanner opens at the last digit.`}</p>}
        </ListIntro>
    );
};
