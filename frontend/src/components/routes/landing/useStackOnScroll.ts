import {RefObject, useEffect} from "react";
import {onSmoothScroll} from "./smoothScroll.ts";

const MIN_WIDTH = 701;
// Any lower, the covered section would barely have room to be seen leaving.
const MIN_HEIGHT = 600;
// Speed of the covered section, as a share of the page's: fast at first, then
// slower and slower until the next one covers it. PARALLAX is the average.
const START_SPEED = 0.6;
const END_SPEED = 0.1;
const PARALLAX = (START_SPEED + END_SPEED) / 2;
// Way gone by the section at `t` of its covering: the integral of its speed.
const travelled = (t: number) => START_SPEED * t - ((START_SPEED - END_SPEED) / 2) * t * t;
// Air added under a stacked section, as a share of the screen height.
const EXTRA_BOTTOM = 0.12;
// Fade of its content, once covered.
const MAX_FADE = 0.4;

interface Stack {
    // Page scroll when it stops: its foot on the bottom of the screen, or its top on the top.
    freeze: number;
    // Page scroll during which the next one covers it.
    course: number;
    // Last covering written, from 0 to 1; -1 forces the next write.
    value: number;
}

/**
 * The sections that stack as the page scrolls, like the DEHORS shop's
 * (empilement.ts): a `[data-stack]` section stays in place while the next one,
 * its mountain ridge first, slides over it like a card laid on the pile.
 *
 * Taller than the screen, it scrolls in full until its foot reaches the bottom
 * of the screen, as the next one's ridge comes in; shorter, it stops at the
 * top. From there it keeps rising, slower than the page and slower and slower:
 * the next one catches up and covers it bit by bit, while its content fades a
 * little (--stack-fade). Its bottom gets a little more air (EXTRA_BOTTOM),
 * which the ridge eats first.
 *
 * Held by a `transform` rather than `position: sticky`, which follows Lenis in
 * the same frame. Off on phones, on screens too low and under reduced motion:
 * the sections scroll normally.
 */
export const useStackOnScroll = (root: RefObject<HTMLElement>) => {
    useEffect(() => {
        const page = root.current;
        const sections = [...page?.querySelectorAll<HTMLElement>('[data-stack]') ?? []];
        if (!page || !sections.length) {
            return;
        }

        const stacks = new Map<HTMLElement, Stack>(sections.map((section) => [section, {freeze: 0, course: 1, value: -1}]));
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        let active = false;
        let stale = true;
        let frame: number | null = null;

        const release = (section: HTMLElement) => {
            delete section.dataset.stacked;
            ['transform', 'padding-bottom', '--stack-fade'].forEach((property) => section.style.removeProperty(property));
        };

        const measure = () => {
            stale = false;
            active = window.innerWidth >= MIN_WIDTH && window.innerHeight >= MIN_HEIGHT && !reducedMotion.matches;
            const view = window.innerHeight;

            stacks.forEach((stack, section) => {
                release(section);
                if (!active) {
                    return;
                }
                // Read without the extra air nor the transform holding it, which would give where it is held.
                const bottom = parseFloat(getComputedStyle(section).paddingBottom) || 0;
                section.style.paddingBottom = `${bottom + view * EXTRA_BOTTOM}px`;
                section.dataset.stacked = '';
                const box = section.getBoundingClientRect();
                stack.freeze = box.top + window.scrollY - Math.min(0, view - box.height);
                // The next one catches up at the page's speed minus its own: to cover
                // all of it that is on screen, the page scrolls that many times more.
                stack.course = Math.max(Math.min(box.height, view), 1) / (1 - PARALLAX);
                stack.value = -1;
            });
        };

        const follow = () => {
            frame = null;
            if (stale) {
                measure();
            }
            if (!active) {
                return;
            }

            stacks.forEach((stack, section) => {
                const progress = Math.min(Math.max(window.scrollY - stack.freeze, 0), stack.course);
                const value = progress / stack.course;
                if (value === stack.value) {
                    return;
                }
                stack.value = value;
                // Held back by all the page's way, it keeps only its own rise.
                const held = progress - travelled(value) * stack.course;
                if (held) {
                    section.style.transform = `translate3d(0, ${held.toFixed(2)}px, 0)`;
                } else {
                    section.style.removeProperty('transform');
                }
                if (value) {
                    section.style.setProperty('--stack-fade', (value * MAX_FADE).toFixed(4));
                } else {
                    section.style.removeProperty('--stack-fade');
                }
            });
        };

        const schedule = (remeasure = false) => {
            stale ||= remeasure;
            if (frame === null) {
                frame = requestAnimationFrame(follow);
            }
        };
        // Lenis just moved the page: the stack follows in the same frame.
        const followNow = () => {
            if (frame !== null) {
                cancelAnimationFrame(frame);
            }
            follow();
        };
        const onScroll = () => schedule();
        const onResize = () => schedule(true);

        // Each section's place depends on all that comes before it: the whole page is watched.
        const observer = new ResizeObserver(onResize);
        observer.observe(page);
        sections.forEach((section) => observer.observe(section));
        window.addEventListener('scroll', onScroll, {passive: true});
        window.addEventListener('resize', onResize, {passive: true});
        reducedMotion.addEventListener('change', onResize);
        const stopFollowingLenis = onSmoothScroll(followNow);
        follow();

        return () => {
            observer.disconnect();
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onResize);
            reducedMotion.removeEventListener('change', onResize);
            stopFollowingLenis();
            if (frame !== null) {
                cancelAnimationFrame(frame);
            }
            sections.forEach(release);
        };
    }, [root]);
};
