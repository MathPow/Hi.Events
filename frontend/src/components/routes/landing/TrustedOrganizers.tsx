import {CSSProperties, PointerEvent, useEffect, useRef} from "react";
import {Link} from "react-router";
import classes from "./Landing.module.scss";
import {useMarqueePace} from "./useMarqueePace.ts";
import {DARK_TINTS, seededRandom, TINTS} from "./tints.ts";

export interface Organizer {
    name: string;
    // Its white logo in /landing/organizers, used as a mask.
    logo: string;
    // Width over height of the logo's viewBox.
    ratio: number;
    // Its billetterie page, when it has one.
    url?: string;
}

const COPIES = 4;
const MIN_NAMES_PER_COPY = 7;
const SECONDS_PER_NAME = 6.4;

// Slowed down under the mouse (useMarqueePace).
const HOVER_PACE = 0.2;

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

const shuffle = <T, >(items: T[], random: () => number) => {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) {
        const other = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
    }
    return shuffled;
};

/**
 * Each row in its own order, each round of names reshuffled, never the same
 * logo twice in a row, the copies' seam included.
 */
const repeatShuffled = (organizers: Organizer[], seed: number) => {
    const random = seededRandom(seed);
    const rounds = Math.ceil(MIN_NAMES_PER_COPY / organizers.length);
    let repeated: Organizer[] = [];
    for (let attempt = 0; attempt < 50; attempt++) {
        repeated = Array.from({length: rounds}, () => shuffle(organizers, random)).flat();
        if (organizers.length < 2 || repeated.every((organizer, index) => organizer !== repeated[(index + 1) % repeated.length])) {
            break;
        }
    }
    return repeated;
};

const buildRow = (organizers: Organizer[], tintOffset: number) => {
    // Seeds far apart: close ones draw close orders.
    const repeated = repeatShuffled(organizers, (tintOffset + 1) * 104729);
    return {
        duration: `${repeated.length * SECONDS_PER_NAME}s`,
        pills: repeated.map((organizer, index) => {
            const tint = TINTS[(index + tintOffset) % TINTS.length];
            return {...organizer, tint, dark: DARK_TINTS.has(tint)};
        }),
    };
};

// A wide wordmark is shorter than a squarer logo, for both to weigh the same.
const logoStyle = (organizer: Organizer) => ({
    '--logo': `url('/landing/organizers/${organizer.logo}.svg')`,
    '--logo-scale': (1 / Math.sqrt(organizer.ratio)).toFixed(3),
    aspectRatio: String(organizer.ratio),
}) as CSSProperties;

const clampOffset = (value: number) => Math.min(Math.max(value, -MAX_OFFSET), MAX_OFFSET);

/**
 * Two rows of the organizers' logos scrolling in opposite directions, at the
 * pace of the shop's: slower under the mouse, faster as the page scrolls. A
 * hovered pill leans toward the cursor and fills with its tint.
 */
export const TrustedOrganizers = ({organizers}: { organizers: Organizer[] }) => {
    const rows = [
        {...buildRow(organizers, 0), className: classes.trustRowLeft},
        {...buildRow(organizers, 1), className: classes.trustRowRight},
    ];
    const scroller = useRef<HTMLDivElement>(null);
    const hovering = useMarqueePace(scroller, classes.trustTrack, HOVER_PACE);
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
        if (event.type !== 'pointermove') {
            hovering.current = false;
        }
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
            <ul className={`${classes.visuallyHidden} ${classes.trustNames}`}>
                {organizers.map((organizer) => (
                    <li key={organizer.name}>
                        {organizer.url ? <Link to={organizer.url}>{organizer.name}</Link> : organizer.name}
                    </li>
                ))}
            </ul>
            <div ref={scroller} className={classes.trustScroller} aria-hidden="true" onPointerMove={follow}
                 onPointerEnter={() => hovering.current = true} onPointerLeave={release} onPointerCancel={release}>
                {rows.map((row, rowIndex) => (
                    <div key={rowIndex} className={row.className}>
                        <div className={classes.trustTrack} style={{'--duration': row.duration} as CSSProperties}>
                            {Array.from({length: COPIES}).map((_, copy) => (
                                <ul key={copy} className={classes.trustCopy}>
                                    {row.pills.map((pill, index) => {
                                        const pillClass = `${classes.trustPill} ${pill.dark ? classes.trustPillDark : ''}`;
                                        const pillStyle = {'--tint': pill.tint} as CSSProperties;
                                        const logo = <span className={classes.trustLogo} style={logoStyle(pill)}/>;

                                        return (
                                            <li key={index}>
                                                {/* Out of the tab order: the list above holds the same links. */}
                                                {pill.url ? (
                                                    <Link to={pill.url} tabIndex={-1} className={pillClass} style={pillStyle}>
                                                        {logo}
                                                    </Link>
                                                ) : (
                                                    <span className={pillClass} style={pillStyle}>{logo}</span>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};
