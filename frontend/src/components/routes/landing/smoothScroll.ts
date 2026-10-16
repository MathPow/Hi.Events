import type Lenis from "lenis";

/**
 * Smoothed scrolling by Lenis, like the DEHORS shop: each wheel step is eased
 * over a few frames instead of jumping a notch. Lenis moves nothing itself, it
 * calls `window.scrollTo` every frame, so it stays a real document scroll and
 * the scroll-driven animations keep working.
 *
 * Off on phones (the finger already has its inertia) and under reduced motion.
 */
const MIN_WIDTH = 701;
// Share of the remaining distance covered each frame: higher is livelier.
const LERP = 0.15;

let lenis: Lenis | null = null;
const listeners = new Set<() => void>();

const wanted = () => window.innerWidth >= MIN_WIDTH
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Plugs in the smoothing and returns what unplugs it. */
export const installSmoothScroll = () => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let LenisClass: typeof Lenis | null = null;
    let installed = true;

    // Only touches Lenis when the width crosses the threshold.
    const update = () => {
        if (!LenisClass || !installed) {
            return;
        }
        if (wanted() && !lenis) {
            lenis = new LenisClass({lerp: LERP, autoRaf: true});
            lenis.on('scroll', () => listeners.forEach((listener) => listener()));
        } else if (!wanted() && lenis) {
            lenis.destroy();
            lenis = null;
        }
    };

    import('lenis').then((module) => {
        LenisClass = module.default;
        update();
    });
    window.addEventListener('resize', update, {passive: true});
    preference.addEventListener('change', update);

    return () => {
        installed = false;
        window.removeEventListener('resize', update);
        preference.removeEventListener('change', update);
        lenis?.destroy();
        lenis = null;
    };
};

/** Lenis just moved the page: what follows the scroll can follow in the same frame. */
export const onSmoothScroll = (listener: () => void) => {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
};

/**
 * Glides to a scroll position through Lenis when it runs: a direct
 * `window.scrollTo` would be undone at once, Lenis keeping its own target.
 * Returns false when Lenis is off, for the caller to scroll by itself.
 */
export const glideTo = (top: number) => {
    if (!lenis) {
        return false;
    }
    lenis.scrollTo(top);

    return true;
};
