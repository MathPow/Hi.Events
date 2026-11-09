import {RefObject, useEffect} from "react";

// The stickers' two poses (.sticker, .stickerWord), held 1.2s each.
const POSE_FOR = 1200;

const watched = new Set<HTMLElement>();
let ticker: number | null = null;

const tick = () => {
    const now = performance.now();
    watched.forEach((element) => {
        const delay = parseFloat(element.dataset.tiltDelay ?? '0') * 1000;
        const tilted = Math.floor((now - delay) / POSE_FOR) % 2 === 1;
        if (tilted !== element.hasAttribute('data-tilt')) {
            element.toggleAttribute('data-tilt', tilted);
        }
    });
};

/**
 * Flips a sticker from one pose to the other while it is on screen, with an
 * attribute rather than a CSS animation: the browser then redraws it twice per
 * cycle, not every frame (an animation on a filtered element is redrawn at
 * each frame, even with nothing in between). Also marks it on screen
 * (data-onscreen), for its float to pause off screen. `--tilt-delay` (CSS)
 * still puts the stickers out of step.
 */
export const useStickerTilt = (ref: RefObject<HTMLElement>) => {
    useEffect(() => {
        const element = ref.current;
        if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        element.dataset.tiltDelay = String(parseFloat(getComputedStyle(element).getPropertyValue('--tilt-delay')) || 0);

        const observer = new IntersectionObserver(([entry]) => {
            element.toggleAttribute('data-onscreen', !!entry?.isIntersecting);
            if (entry?.isIntersecting) {
                watched.add(element);
            } else {
                watched.delete(element);
            }
            if (watched.size && ticker === null) {
                ticker = window.setInterval(tick, 100);
            } else if (!watched.size && ticker !== null) {
                window.clearInterval(ticker);
                ticker = null;
            }
        });
        observer.observe(element);

        return () => {
            observer.disconnect();
            watched.delete(element);
            if (!watched.size && ticker !== null) {
                window.clearInterval(ticker);
                ticker = null;
            }
        };
    }, [ref]);
};
