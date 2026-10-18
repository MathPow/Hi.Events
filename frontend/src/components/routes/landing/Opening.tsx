import {memo, useEffect, useRef} from "react";
import {Helmet} from "react-helmet-async";
import classes from "./Landing.module.scss";

/** The DEHORS mountain (dehors-icone.svg of the shop), in its 43 × 49.995 frame. */
const ICON = 'M40.0012 47.0114C40.817 46.8552 41.1942 45.9129 41.692 45.3197C42.2047 44.709 42.7415 44.1157 42.8885 43.3334C43.0309 42.5744 43.0705 41.7279 42.8035 40.9471C42.5658 40.2518 42.4955 39.4132 42.2061 38.5767C41.9566 37.8553 41.4898 37.1536 41.2076 36.3431C40.9518 35.6085 40.6086 34.8658 40.3302 34.069C40.0703 33.3257 40.016 32.4837 39.7397 31.6953C39.477 30.9462 38.9578 30.2648 38.6829 29.4828C38.4181 28.7294 38.1686 27.9554 37.8949 27.1784C37.6283 26.4211 37.535 25.5924 37.2623 24.8191C36.9941 24.0588 36.2418 23.4602 35.97 22.6902C35.7003 21.9267 35.5343 21.1235 35.263 20.3564C34.992 19.59 35.1767 18.6639 34.906 17.8996C34.6337 17.1304 34.2379 16.4069 33.9683 15.6456C33.6946 14.8731 33.1124 14.2147 32.8434 13.4563C32.5682 12.6807 32.2703 11.923 32.0025 11.1686C31.7258 10.3886 31.5096 9.60228 31.2432 8.85211C30.9644 8.06722 30.7063 7.29546 30.442 6.55134C30.1603 5.75898 30.0563 4.93293 29.7944 4.19648C29.5087 3.39303 29.2992 2.6037 29.0415 1.87936C28.7676 1.10981 28.1517 0.576398 27.5421 0.285774C26.8712 -0.0341137 26.0391 -0.102531 25.3638 0.16791C24.7339 0.420188 24.4562 1.09589 24.1772 1.87129C23.7754 2.98757 23.4073 2.85678 23.0055 3.97286C22.604 5.08894 22.9905 5.22618 22.589 6.34205C22.1873 7.45813 21.7028 7.28617 21.3011 8.40225C20.8994 9.51832 21.1247 9.59845 20.7232 10.7145C20.3217 11.8304 20.6397 11.9432 20.238 13.0589C19.8363 14.175 19.8515 14.1804 19.45 15.2965C19.0482 16.413 18.3978 16.1821 17.9961 17.2986C17.5944 18.4146 18.2025 18.6306 17.8008 19.7467C17.3989 20.8635 16.9301 20.697 16.5282 21.8139C16.1263 22.9308 16.5739 22.9607 15.9145 24.039C15.6284 23.4301 15.5185 22.9599 15.0387 21.8402C14.5586 20.7198 14.4564 20.763 13.9762 19.6427C13.4961 18.5224 13.2163 18.6407 12.7361 17.5202C12.4228 16.7892 12.2716 16.3504 11.6616 16.0993C10.9919 15.8236 11.0508 14.9802 10.086 15.0787C9.42662 15.1461 8.21353 16.3716 7.96502 17.4511C7.68644 18.6621 7.92824 18.745 7.54318 19.9269C7.15812 21.1086 7.22863 21.1312 6.84377 22.3128C6.45871 23.4947 6.48736 23.5038 6.1023 24.6857C5.71724 25.8675 5.52197 25.8048 5.13691 26.9866C4.75185 28.1687 4.86767 28.2058 4.48241 29.3877C4.09735 30.5694 3.81369 30.4781 3.42863 31.6598C3.04357 32.8419 2.89767 32.7951 2.51261 33.9771C2.12755 35.1588 2.58881 35.3071 2.20395 36.4888C1.81869 37.6713 1.88229 37.6917 1.49703 38.8741C1.11176 40.0566 0.634044 39.903 0.248781 41.0857C-0.0182215 41.9053 -0.0751166 42.8553 0.101462 43.6371C0.283731 44.4446 0.81489 45.2261 1.38344 45.8314C1.9339 46.4172 2.75848 46.7077 3.58997 46.9519C4.25503 47.1472 4.8754 47.7747 5.67193 47.9769C6.36281 48.1525 7.14755 48.1775 7.9319 48.3487C8.63903 48.5029 9.40387 48.5796 10.1833 48.7231C10.902 48.8555 11.6226 49.1919 12.3998 49.3098C13.1269 49.42 13.9171 49.297 14.6929 49.3901C15.4267 49.4781 16.186 49.5467 16.9614 49.6155C17.7002 49.6811 18.4842 49.3354 19.259 49.3804C20.0015 49.4236 20.7445 49.6829 21.5185 49.7043C22.3171 49.7265 23.1008 50.0083 23.8659 49.9945C24.6667 49.98 25.4494 49.8163 26.2114 49.7673C27.0128 49.7158 27.8059 49.7388 28.5622 49.6547C29.3632 49.5655 30.0923 49.1245 30.8404 49.0056C31.6408 48.8783 32.4443 48.9384 33.1811 48.785C33.9813 48.6183 34.7341 48.3997 35.4555 48.2127C36.2577 48.0044 37.0083 48.1662 37.7075 47.9464C38.5187 47.6922 39.1246 47.1793 40.0012 47.0114Z';
const WIDTH = 43;
const HEIGHT = 49.995;
// The zoom starts from the largest circle inscribed in the mountain's base: once
// that circle passes the farthest corner of the screen, the window covers it all.
const ZOOM_CENTER = {x: 24.5, y: 35.5};
const INSCRIBED_RADIUS = 14;

// The shop's timings (IntroChargement.vue): the empty mountain shows a moment
// before the wave fills it, then a pause, it draws in, and opens onto the page.
const EMPTY_FOR = 100;
const FILL_FOR = 450;
// A slow network never holds the visitor on the opening.
const MAX_WAIT = 8000;
const PAUSE_FOR = 220;
const SHRINK_FOR = 300;
const SHRINK_SCALE = 0.7;
// Zoom speed in log of scale per second, reached after the ramp up.
const ZOOM_SPEED = 7;
const RAMP_UP_FOR = 200;
const FADE_FOR = 220;
// The CSS steps the opening aside at 10s when no script took it over (.opening).
const FALLBACK_AFTER = 10000;

// The cream wave, in a 100 × 100 frame stretched over the mountain's.
const WAVE_EMPTY = 'M 0 100 V 105 H 100 V 100 Z';
const WAVE_FULL = 'M 0 0 H 100 V 100 H 0 Z';

// What the window waits for, fetched with the page for the window to show it from the start.
const POSTER = '/landing/photos/hero-groupe.webp';

const ICON_ID = 'landing-opening-icon';
const SILHOUETTE_ID = 'landing-opening-silhouette';
const WINDOW_ID = 'landing-opening-window';

const ease = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
const smooth = (t: number) => t * t * (3 - 2 * t);

const pageReady = () => {
    const poster = new Image();
    poster.src = POSTER;

    return Promise.allSettled([
        poster.decode(),
        document.fonts?.load('400 32px FatFrank'),
        document.fonts?.load('700 20px Allotrope'),
    ]);
};

/**
 * The DEHORS shop's opening (IntroChargement.vue) on the first load of the
 * landing page: an orange screen with the empty mountain, which a cream wave
 * fills from the bottom while the page loads, waiting at 88% for it. Filled,
 * the mountain draws in, then opens: a window onto the page that grows until
 * it covers the screen, the cream fading as it starts. Rendered by the server
 * so it is there from the first paint, the mountain drawn by CSS until the
 * script measures the screen (.opening); the page under it stays readable to
 * screen readers.
 */
export const Opening = memo(({onReveal, onDone}: { onReveal: () => void, onDone: () => void }) => {
    const root = useRef<HTMLDivElement>(null);
    const backdrop = useRef<SVGRectElement>(null);
    const hole = useRef<SVGUseElement>(null);
    const logo = useRef<SVGGElement>(null);
    const wave = useRef<SVGPathElement>(null);

    useEffect(() => {
        const [element, backdropElement, holeElement, logoElement, waveElement]
            = [root.current, backdrop.current, hole.current, logo.current, wave.current];
        if (!element || !backdropElement || !holeElement || !logoElement || !waveElement) {
            return;
        }

        let revealed = false;
        let done = false;
        const reveal = () => {
            if (!revealed) {
                revealed = true;
                element.setAttribute('data-open', '');
                onReveal();
            }
        };
        const finish = () => {
            if (!done) {
                done = true;
                reveal();
                onDone();
            }
        };

        if (performance.now() > FALLBACK_AFTER) {
            finish();
            return;
        }

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let unit = 1;
        let center = {x: 0, y: 0};
        let opened = false;
        let ready = false;
        let frame = 0;
        let timeout: number | undefined;

        const measure = () => {
            const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
            // Same size as the mountain drawn by CSS: min(8rem, 100vw - 4rem).
            unit = Math.min(8 * rem, window.innerWidth - 4 * rem) / WIDTH;
            center = {x: window.innerWidth / 2, y: window.innerHeight / 2};
        };

        /** Where to put ZOOM_CENTER on screen for the mountain to stay centred at this scale. */
        const centredAnchor = (scale: number) => ({
            x: center.x + (ZOOM_CENTER.x - WIDTH / 2) * unit * scale,
            y: center.y + (ZOOM_CENTER.y - HEIGHT / 2) * unit * scale,
        });

        const place = (scale: number, anchor = centredAnchor(scale)) => {
            const transform = `translate(${anchor.x} ${anchor.y}) scale(${unit * scale}) `
                + `translate(${-ZOOM_CENTER.x} ${-ZOOM_CENTER.y})`;
            logoElement.setAttribute('transform', transform);
            holeElement.setAttribute('transform', transform);
        };

        const resize = () => {
            measure();
            if (!opened) {
                place(1);
            }
        };

        // The script's mountain takes over from the CSS one at the same place, in the same frame.
        measure();
        place(1);
        element.setAttribute('data-live', '');
        window.addEventListener('resize', resize);

        pageReady().then(() => {
            ready = true;
            if (reducedMotion) {
                finish();
            }
        });

        if (reducedMotion) {
            waveElement.setAttribute('d', WAVE_FULL);
            timeout = window.setTimeout(finish, MAX_WAIT);
        } else {
            const start = performance.now();
            let previous = start;
            let progress = 0;
            let filledAt = 0;
            let zoomAnchor = {x: 0, y: 0};
            let finalScale = 1;

            const fill = (now: number) => {
                const elapsed = now - start;
                const delta = Math.min(now - previous, 64);
                previous = now;
                if (elapsed < EMPTY_FOR) {
                    return;
                }

                // The wave waits for the page at 88%, then finishes its way smoothly.
                const target = ready || elapsed >= MAX_WAIT ? 1 : 0.88;
                progress = Math.min(target, progress + delta / FILL_FOR);
                if (progress >= 1) {
                    waveElement.setAttribute('d', WAVE_FULL);
                    filledAt = now;
                    return;
                }

                // The level rises from the bottom, like water filling the mountain.
                const y = 105 - progress * 110;
                const crest = Math.sin(elapsed / 330) * 3.5;
                const trough = Math.cos(elapsed / 410) * 3.5;
                waveElement.setAttribute('d', `M 0 100 V ${y} C 16 ${y + crest}, 34 ${y + trough}, 50 ${y} `
                    + `S 84 ${y - crest}, 100 ${y} V 100 Z`);
            };

            /** Filled: a short pause, the mountain draws in, then opens onto the page. */
            const open = (now: number) => {
                const t = now - filledAt - PAUSE_FOR;
                if (t < SHRINK_FOR) {
                    place(1 - (1 - SHRINK_SCALE) * ease(Math.max(t, 0) / SHRINK_FOR));
                    return false;
                }

                if (!opened) {
                    opened = true;
                    zoomAnchor = centredAnchor(SHRINK_SCALE);
                    const corner = Math.hypot(
                        Math.max(zoomAnchor.x, window.innerWidth - zoomAnchor.x),
                        Math.max(zoomAnchor.y, window.innerHeight - zoomAnchor.y),
                    );
                    finalScale = corner / (INSCRIBED_RADIUS * unit);
                    backdropElement.setAttribute('mask', `url(#${WINDOW_ID})`);
                    reveal();
                }

                // The zoom speeds up during the ramp, then grows at a constant rate of
                // its log, which reads as a steady speed despite the exploding scale.
                const z = (t - SHRINK_FOR) / 1000;
                const ramp = RAMP_UP_FOR / 1000;
                const logScale = z < ramp ? ZOOM_SPEED * z * z / (2 * ramp) : ZOOM_SPEED * (z - ramp / 2);
                const scale = SHRINK_SCALE * Math.exp(logScale);
                place(scale, zoomAnchor);
                // The cream mountain fades as the zoom starts, for the page to show in the window.
                logoElement.setAttribute('opacity', String(1 - smooth(Math.min(z * 1000 / FADE_FOR, 1))));
                return scale >= finalScale;
            };

            const animate = (now: number) => {
                if (!filledAt) {
                    fill(now);
                } else if (open(now)) {
                    finish();
                    return;
                }
                frame = requestAnimationFrame(animate);
            };
            frame = requestAnimationFrame(animate);
        }

        return () => {
            cancelAnimationFrame(frame);
            window.clearTimeout(timeout);
            window.removeEventListener('resize', resize);
        };
    }, [onReveal, onDone]);

    return (
        <div ref={root} className={classes.opening} data-landing-opening="" aria-hidden="true">
            <Helmet>
                <link rel="preload" as="image" href={POSTER} fetchPriority="high"/>
                <noscript>{`<style>.${classes.opening}{display:none}</style>`}</noscript>
            </Helmet>
            <svg className={classes.openingScene} focusable="false">
                <defs>
                    <path id={ICON_ID} d={ICON}/>
                    <clipPath id={SILHOUETTE_ID}>
                        <use href={`#${ICON_ID}`}/>
                    </clipPath>
                    {/* White everywhere but the mountain: there, the orange becomes a window onto the page. */}
                    <mask id={WINDOW_ID} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
                        <rect width="100%" height="100%" fill="white"/>
                        <use ref={hole} href={`#${ICON_ID}`} fill="black"/>
                    </mask>
                </defs>
                <rect ref={backdrop} className={classes.openingBackdrop} width="100%" height="100%"/>
                <g ref={logo} className={classes.openingLogo}>
                    <g clipPath={`url(#${SILHOUETTE_ID})`}>
                        <rect className={classes.openingEmpty} width={WIDTH} height={HEIGHT}/>
                        <path ref={wave} className={classes.openingWave} d={WAVE_EMPTY}
                              transform={`scale(${WIDTH / 100} ${HEIGHT / 100})`}/>
                    </g>
                </g>
            </svg>
            <span className={classes.openingTint}/>
        </div>
    );
});
