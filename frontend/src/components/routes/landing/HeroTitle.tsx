import {CSSProperties, useEffect, useRef} from "react";
import {t} from "@lingui/macro";
import classes from "./Landing.module.scss";

const WORD_SPEEDS = [0.1, 0.18, 0.07, 0.15, 0.05, 0.13];

/**
 * The hero headline. On scroll, each word rises at its own speed, alternating
 * from one to the next (like the DEHORS shop wordmark).
 */
export const HeroTitle = () => {
    const root = useRef<HTMLDivElement>(null);
    const words = t`Fewer fees, more people.`.split(' ');

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        let frame: number | null = null;
        const update = () => {
            frame = null;
            root.current?.style.setProperty('--scroll', `${Math.min(window.scrollY, window.innerHeight)}px`);
        };
        const onScroll = () => {
            if (frame === null) {
                frame = requestAnimationFrame(update);
            }
        };

        update();
        window.addEventListener('scroll', onScroll, {passive: true});

        return () => {
            window.removeEventListener('scroll', onScroll);
            if (frame !== null) {
                cancelAnimationFrame(frame);
            }
        };
    }, []);

    return (
        <div ref={root} className={classes.heroTitle}>
            <h1>
                {words.map((word, index) => (
                    <span key={index}>
                        {index > 0 && ' '}
                        <span className={classes.heroWord}
                              style={{'--speed': WORD_SPEEDS[index % WORD_SPEEDS.length]} as CSSProperties}>
                            {word}
                        </span>
                    </span>
                ))}
            </h1>
        </div>
    );
};
