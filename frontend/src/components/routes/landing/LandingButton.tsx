import {ComponentPropsWithoutRef, ElementType} from "react";
import {useRoughButton} from "../../../hooks/useRoughButton.ts";
import classes from "./Landing.module.scss";

/** On hover, the letters wiggle one after the other; the wave loops every six letters. */
export const ShakyText = ({text}: { text: string }) => {
    let position = 0;
    const words = text.split(' ').map((word) => {
        const letters = Array.from(word).map((character, i) => ({character, delay: `${((position + i) % 6) * 0.05}s`}));
        position += letters.length + 1;
        return letters;
    });

    return (
        <span className={classes.shaky}>
            <span className={classes.visuallyHidden}>{text}</span>
            {words.map((letters, w) => (
                <span key={w} className={classes.shakyWord} aria-hidden="true">
                    {letters.map((letter, l) => (
                        <span key={l} className={classes.shakyLetter} style={{animationDelay: letter.delay}}>
                            {letter.character}
                        </span>
                    ))}
                </span>
            ))}
        </span>
    );
};

type Variant = 'orange' | 'dark' | 'ghost';

/** The DEHORS shop button: a rough pill whose outline boils and which hops on hover. Ghosts have no fill to cut. */
export const LandingButton = <T extends ElementType = 'button'>({as, variant = 'orange', label, className, ...props}: {
    as?: T;
    variant?: Variant;
    label: string;
    className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>) => {
    const Component = as ?? 'button';
    const rough = useRoughButton<HTMLElement>();
    const ghost = variant === 'ghost';

    return (
        <Component ref={ghost ? undefined : rough} {...props}
                   className={`${classes.button} ${classes[`button-${variant}`]} ${ghost ? '' : classes.buttonRough} ${className ?? ''}`}>
            <ShakyText text={label}/>
        </Component>
    );
};
