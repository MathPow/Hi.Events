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
        let visible = false;
        let pace = 1;
        let lastY = 0;
        let lastTime = 0;
        let animations: Animation[] = [];
        let frames = 0;

        // The rows' animations, looked up again now and then (dragging restarts them), not at each frame.
        const findAnimations = () => {
            animations = Array.from(element.querySelectorAll<HTMLElement>(`.${track}`))
                .flatMap((row) => row.getAnimations());
        };

        const tick = (now: number) => {
            const speed = Math.abs(window.scrollY - lastY) / Math.max(now - lastTime, 1);
            lastY = window.scrollY;
            lastTime = now;
            const target = (hovering.current ? hoverPace : 1) + Math.min(speed * MOMENTUM, MAX_MOMENTUM);
            pace += (target - pace) * SUPPLENESS;
            if (Math.abs(target - pace) < 0.001) {
                pace = target;
            }
            if (frames++ % 60 === 0) {
                findAnimations();
            }
            animations.forEach((animation) => {
                if (animation.playbackRate !== pace) {
                    animation.playbackRate = pace;
                }
            });
            // Settled (no scroll, the pace reached): the loop rests until a scroll or the mouse wakes it.
            loop = pace === target && speed === 0 ? null : requestAnimationFrame(tick);
        };
        const wake = () => {
            if (visible && loop === null) {
                lastY = window.scrollY;
                lastTime = performance.now();
                loop = requestAnimationFrame(tick);
            }
        };
        const observer = new IntersectionObserver(([entry]) => {
            visible = !!entry?.isIntersecting;
            if (visible) {
                frames = 0;
                wake();
            } else if (loop !== null) {
                cancelAnimationFrame(loop);
                loop = null;
            }
        });
        observer.observe(element);
        window.addEventListener('scroll', wake, {passive: true});
        element.addEventListener('pointerenter', wake);
        element.addEventListener('pointerleave', wake);

        return () => {
            observer.disconnect();
            window.removeEventListener('scroll', wake);
            element.removeEventListener('pointerenter', wake);
            element.removeEventListener('pointerleave', wake);
            if (loop !== null) {
                cancelAnimationFrame(loop);
            }
        };
    }, [scroller, track, hoverPace, active]);

    return hovering;
};
