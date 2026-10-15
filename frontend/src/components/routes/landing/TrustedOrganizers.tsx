import {CSSProperties, PointerEvent, useEffect, useRef} from "react";
import classes from "./Landing.module.scss";

const COPIES = 4;
const MIN_NAMES_PER_COPY = 7;
const SECONDS_PER_NAME = 6.4;
const TINTS = ['#352924', '#e3ad92', '#ffad7d', '#f98043'];
const DARK_TINTS = new Set(['#352924', '#f98043']);

const PULL = 0.1;
const MAX_OFFSET = 6;
const HOVER_SCALE = 1.03;
const EASING = 0.18;

interface Motion {
    x: number;
    y: number;
    scale: number;
    targetX: number;
    targetY: number;
    targetScale: number;
}

const initials = (name: string) =>
    name.split(/\s+/).map((word) => word.match(/\p{L}/u)?.[0] ?? '').join('').toLocaleUpperCase('fr-CA');

const buildRow = (names: string[], tintOffset: number) => {
    const repeated = Array.from({length: Math.ceil(MIN_NAMES_PER_COPY / names.length)}, () => names).flat();
    return {
        duration: `${repeated.length * SECONDS_PER_NAME}s`,
        pills: repeated.map((name, index) => {
            const tint = TINTS[(index + tintOffset) % TINTS.length];
            return {name, initials: initials(name), tint, dark: DARK_TINTS.has(tint)};
        }),
    };
};

const clampOffset = (value: number) => Math.min(Math.max(value, -MAX_OFFSET), MAX_OFFSET);

/** Two rows of pills scrolling in opposite directions; a hovered pill leans toward the cursor and fills with its tint. */
export const TrustedOrganizers = ({names}: { names: string[] }) => {
    const rows = [
        {...buildRow(names, 0), className: classes.trustRowLeft},
        {...buildRow(names, 1), className: classes.trustRowRight},
    ];
    const motions = useRef(new Map<HTMLElement, Motion>());
    const hovered = useRef<HTMLElement | null>(null);
    const frame = useRef<number | null>(null);

    useEffect(() => () => {
        if (frame.current !== null) {
            cancelAnimationFrame(frame.current);
        }
    }, []);

    const animate = () => {
        frame.current = null;
        let moving = false;
        for (const [pill, motion] of motions.current) {
            motion.x += (motion.targetX - motion.x) * EASING;
            motion.y += (motion.targetY - motion.y) * EASING;
            motion.scale += (motion.targetScale - motion.scale) * EASING;
            const arrived = Math.abs(motion.targetX - motion.x) < 0.05 && Math.abs(motion.targetY - motion.y) < 0.05
                && Math.abs(motion.targetScale - motion.scale) < 0.0005;
            if (arrived) {
                Object.assign(motion, {x: motion.targetX, y: motion.targetY, scale: motion.targetScale});
            }
            const atRest = motion.x === 0 && motion.y === 0 && motion.scale === 1;
            pill.style.transform = atRest
                ? ''
                : `translate(${motion.x.toFixed(2)}px, ${motion.y.toFixed(2)}px) scale(${motion.scale.toFixed(4)})`;
            if (atRest && pill !== hovered.current) {
                motions.current.delete(pill);
            } else if (!arrived) {
                moving = true;
            }
        }
        if (moving) {
            frame.current = requestAnimationFrame(animate);
        }
    };

    const restart = () => {
        if (frame.current === null) {
            frame.current = requestAnimationFrame(animate);
        }
    };

    /** The cursor's entry or exit point becomes the centre of the fill. */
    const placeOrigin = (pill: HTMLElement, event: PointerEvent) => {
        const box = pill.getBoundingClientRect();
        const scale = motions.current.get(pill)?.scale ?? 1;
        pill.style.setProperty('--origin-x', `${(event.clientX - box.left) / scale}px`);
        pill.style.setProperty('--origin-y', `${(event.clientY - box.top) / scale}px`);
    };

    const release = (event: PointerEvent) => {
        const pill = hovered.current;
        if (!pill) {
            return;
        }
        hovered.current = null;
        placeOrigin(pill, event);
        pill.classList.remove(classes.trustPillFilled);
        const motion = motions.current.get(pill);
        if (motion) {
            Object.assign(motion, {targetX: 0, targetY: 0, targetScale: 1});
        }
        restart();
    };

    const follow = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse') {
            return;
        }
        const pill = (event.target as Element).closest<HTMLElement>(`.${classes.trustPill}`);
        if (pill !== hovered.current) {
            release(event);
            if (!pill) {
                return;
            }
            hovered.current = pill;
            placeOrigin(pill, event);
            pill.classList.add(classes.trustPillFilled);
        }
        if (!pill || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        let motion = motions.current.get(pill);
        if (!motion) {
            motion = {x: 0, y: 0, scale: 1, targetX: 0, targetY: 0, targetScale: 1};
            motions.current.set(pill, motion);
        }
        // Measured without the current transform, otherwise the pill chases itself.
        const box = pill.getBoundingClientRect();
        motion.targetX = clampOffset((event.clientX - (box.left + box.width / 2 - motion.x)) * PULL);
        motion.targetY = clampOffset((event.clientY - (box.top + box.height / 2 - motion.y)) * PULL);
        motion.targetScale = HOVER_SCALE;
        restart();
    };

    return (
        <>
            <ul className={classes.visuallyHidden}>
                {names.map((name) => <li key={name}>{name}</li>)}
            </ul>
            <div className={classes.trustScroller} aria-hidden="true" onPointerMove={follow}
                 onPointerLeave={release} onPointerCancel={release}>
                {rows.map((row, rowIndex) => (
                    <div key={rowIndex} className={row.className}>
                        <div className={classes.trustTrack} style={{'--duration': row.duration} as CSSProperties}>
                            {Array.from({length: COPIES}).map((_, copy) => (
                                <ul key={copy} className={classes.trustCopy}>
                                    {row.pills.map((pill, index) => (
                                        <li key={index}>
                                            <span className={`${classes.trustPill} ${pill.dark ? classes.trustPillDark : ''}`}
                                                  style={{'--tint': pill.tint} as CSSProperties}>
                                                <span className={classes.trustAvatar}>{pill.initials}</span>
                                                <span className={classes.trustName}>{pill.name}</span>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};
