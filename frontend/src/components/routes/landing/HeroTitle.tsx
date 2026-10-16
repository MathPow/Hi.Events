import {CSSProperties, Fragment, useEffect, useRef} from "react";
import {t} from "@lingui/macro";
import classes from "./Landing.module.scss";

const WORD_SPEEDS = [0.1, 0.18, 0.07, 0.15, 0.05, 0.13];
// Where each word comes from in the entrance, one high and one low in turn,
// like the letters of the shop's wordmark (.landing[data-entrance]).
const WORD_FROM = ['-45%', '105%', '-105%', '100%', '-90%', '60%'];

// The headline's "fewer" and "more" are between brackets in each language: the
// first is a light red sticker, the second a green one.
const STICKER_WORD = /^\[(.+)]$/;
const STICKER_COLOURS = [classes.stickerWordFewer, classes.stickerWordMore];
const EDGE_FILTER = 'hero-sticker-edge';

/**
 * The hero headline and its subtitle. On scroll, each word rises at its own
 * speed, alternating from one to the next (like the DEHORS shop wordmark). Its
 * "fewer" and "more" are stickers, in a cream outline cut a little roughly,
 * and each starts a line; the sentence stays as plain words for screen readers.
 */
export const HeroTitle = () => {
    const root = useRef<HTMLDivElement>(null);
    let stickers = 0;
    const words = t`[Fewer] fees, [More] people.`.split(' ').map((word) => {
        const sticker = word.match(STICKER_WORD);
        return sticker ? {text: sticker[1], colour: STICKER_COLOURS[stickers++ % STICKER_COLOURS.length]} : {text: word};
    });
    // A sticker holds on to the word after it, never left alone at the end of a line.
    const groups = words.reduce<{ word: typeof words[number], index: number }[][]>((all, word, index) => {
        if (index > 0 && words[index - 1].colour) {
            all[all.length - 1].push({word, index});
        } else {
            all.push([{word, index}]);
        }
        return all;
    }, []);
    // A new line at each sticker after the first.
    const lines = groups.reduce<typeof groups[]>((all, group) => {
        if (!all.length || (group[0].word.colour && group[0].index > 0)) {
            all.push([group]);
        } else {
            all[all.length - 1].push(group);
        }
        return all;
    }, []);

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
                {lines.map((line) => (
                    <span key={line[0][0].index} className={classes.heroLine} aria-hidden="true">
                        {line.map((group, position) => (
                            <span key={group[0].index} className={group.length > 1 ? classes.heroWordGroup : undefined}>
                                {group.map(({word, index}, inGroup) => (
                                    <Fragment key={index}>
                                        {(position > 0 || inGroup > 0) && ' '}
                                        <span className={classes.heroWord} style={{
                                            '--speed': WORD_SPEEDS[index % WORD_SPEEDS.length],
                                            '--from-y': WORD_FROM[index % WORD_FROM.length],
                                        } as CSSProperties}>
                                            {word.colour ? (
                                                <span className={`${classes.stickerWord} ${word.colour}`}
                                                      data-text={word.text}>
                                                    {word.text}
                                                </span>
                                            ) : word.text}
                                        </span>
                                    </Fragment>
                                ))}
                            </span>
                        ))}
                    </span>
                ))}
                <span className={classes.visuallyHidden}>{t`Fewer fees, more people.`}</span>
            </h1>
            <p className={classes.heroSubtitle}>{t`The Quebec ticketing platform built for the sports community.`}</p>
            {/* Roughens the stickers' cream outline (.stickerWord::before). */}
            <svg className={classes.stickerWordFilter} aria-hidden="true" focusable="false">
                <filter id={EDGE_FILTER} x="-10%" y="-20%" width="120%" height="140%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7"/>
                    <feDisplacementMap in="SourceGraphic" scale="3" xChannelSelector="R" yChannelSelector="G"/>
                </filter>
            </svg>
        </div>
    );
};
