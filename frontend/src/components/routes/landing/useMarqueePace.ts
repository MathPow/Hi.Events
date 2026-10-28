import {RefObject, useEffect, useRef} from "react";

// The rows' pace, like the shop's (RelaisBenevoles.vue): the CSS animation's,
// times its playback rate. Changed under the mouse, sped up by the page's
// scroll (MOMENTUM per px scrolled per ms, MAX_MOMENTUM more at most), it eases
// toward its target.
const MOMENTUM = 3;
const MAX_MOMENTUM = 8;
const SUPPLENESS = 0.08;

/**
 * Paces the CSS animations of the `track` elements inside `scroller`, only
 * while it is on screen. The returned flag is raised while the mouse is over
 * the rows: the pace then eases toward `hoverPace`.
 */
export const useMarqueePace = (scroller: RefObject<HTMLElement>, track: string, hoverPace: number, active = true) => {
    const hovering = useRef(false);

    useEffect(() => {
        const element = scroller.current;
        if (!active || !element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        let loop: number | null = null;
        let pace = 1;
        let lastY = 0;
        let lastTime = 0;

        const tick = (now: number) => {
            loop = requestAnimationFrame(tick);
            const speed = Math.abs(window.scrollY - lastY) / Math.max(now - lastTime, 1);
            lastY = window.scrollY;
            lastTime = now;
            const target = (hovering.current ? hoverPace : 1) + Math.min(speed * MOMENTUM, MAX_MOMENTUM);
            pace += (target - pace) * SUPPLENESS;
            if (Math.abs(target - pace) < 0.001) {
                pace = target;
            }
            element.querySelectorAll<HTMLElement>(`.${track}`).forEach((row) => {
                row.getAnimations().forEach((animation) => {
                    if (animation.playbackRate !== pace) {
                        animation.playbackRate = pace;
                    }
                });
            });
        };
        const observer = new IntersectionObserver(([entry]) => {
            if (entry?.isIntersecting && loop === null) {
                lastY = window.scrollY;
                lastTime = performance.now();
                loop = requestAnimationFrame(tick);
            } else if (!entry?.isIntersecting && loop !== null) {
                cancelAnimationFrame(loop);
                loop = null;
            }
        });
        observer.observe(element);

        return () => {
            observer.disconnect();
            if (loop !== null) {
                cancelAnimationFrame(loop);
            }
        };
    }, [scroller, track, hoverPace, active]);

    return hovering;
};
