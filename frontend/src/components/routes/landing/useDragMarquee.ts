import {RefObject, useEffect} from "react";

// Past this many pixels, a press becomes a drag rather than a click.
const DRAG_THRESHOLD = 6;
// A throw's speed is read over its last moves, within this many ms.
const THROW_WINDOW = 80;
// In px per ms.
const MAX_THROW = 3;
// The glide after a throw keeps this share of its speed every 16 ms,
const FRICTION = 0.95;
// and stops below this speed, in px per ms.
const MIN_SPEED = 0.01;

/**
 * Lets the rows of `scroller` be grabbed and thrown sideways, with the mouse,
 * a finger or a trackpad, without stopping their rolling: their CSS animations
 * (on the `track` elements, each sliding by one copy, its first child, per
 * loop) are moved through time, and roll on from where they are let go.
 * Without motion there is no animation, and the scroller's own scroll moves.
 */
export const useDragMarquee = (scroller: RefObject<HTMLElement>, track: string, active = true) => {
    useEffect(() => {
        const element = scroller.current;
        if (!active || !element) {
            return;
        }
        const rows = () => [...element.querySelectorAll<HTMLElement>(`.${track}`)];
        const animations = () => rows().flatMap((row) => row.getAnimations());

        // Moves the rows by `dx` px, to the right when positive.
        const shift = (dx: number) => {
            let moved = false;
            for (const row of rows()) {
                const loop = (row.firstElementChild as HTMLElement | null)?.getBoundingClientRect().width;
                for (const animation of row.getAnimations()) {
                    const duration = Number(animation.effect?.getComputedTiming().duration);
                    if (!loop || !duration || animation.currentTime === null) {
                        continue;
                    }
                    const time = (Number(animation.currentTime) - dx / loop * duration) % duration;
                    animation.currentTime = time < 0 ? time + duration : time;
                    moved = true;
                }
            }
            if (!moved) {
                element.scrollLeft -= dx;
            }
        };

        let press: { id: number, x: number, y: number } | null = null;
        let dragging = false;
        let lastX = 0;
        let moves: { x: number, time: number }[] = [];
        let glide: number | null = null;
        let swallowClick = false;

        const stopGlide = () => {
            if (glide !== null) {
                cancelAnimationFrame(glide);
                glide = null;
            }
        };

        const throwAt = (speed: number) => {
            let last = performance.now();
            const step = (now: number) => {
                const elapsed = Math.min(now - last, 50);
                last = now;
                shift(speed * elapsed);
                speed *= FRICTION ** (elapsed / 16);
                glide = Math.abs(speed) > MIN_SPEED ? requestAnimationFrame(step) : null;
            };
            glide = requestAnimationFrame(step);
        };

        const endDrag = () => {
            dragging = false;
            delete element.dataset.dragging;
            animations().forEach((animation) => animation.play());
        };

        const down = (event: PointerEvent) => {
            // Without motion, a finger scrolls the row natively.
            if (event.button !== 0 || (event.pointerType !== 'mouse' && !animations().length)) {
                return;
            }
            stopGlide();
            swallowClick = false;
            press = {id: event.pointerId, x: event.clientX, y: event.clientY};
            lastX = event.clientX;
            moves = [{x: event.clientX, time: event.timeStamp}];
        };

        const move = (event: PointerEvent) => {
            if (!press || event.pointerId !== press.id) {
                return;
            }
            // Released outside the row, before it became a drag.
            if (event.pointerType === 'mouse' && !(event.buttons & 1)) {
                press = null;
                return;
            }
            if (!dragging) {
                const dx = event.clientX - press.x;
                const dy = event.clientY - press.y;
                if (Math.hypot(dx, dy) < DRAG_THRESHOLD) {
                    return;
                }
                if (Math.abs(dy) > Math.abs(dx)) {
                    press = null;
                    return;
                }
                dragging = true;
                element.setPointerCapture(event.pointerId);
                element.dataset.dragging = '';
                // Held still under the finger; it rolls on once let go.
                animations().forEach((animation) => animation.pause());
            }
            shift(event.clientX - lastX);
            lastX = event.clientX;
            moves.push({x: event.clientX, time: event.timeStamp});
            moves = moves.filter((entry) => event.timeStamp - entry.time <= THROW_WINDOW);
        };

        const release = (event: PointerEvent) => {
            if (!press || event.pointerId !== press.id) {
                return;
            }
            press = null;
            if (!dragging) {
                return;
            }
            endDrag();
            if (event.type === 'pointercancel') {
                return;
            }
            // A drag ending on an event does not open it.
            swallowClick = true;
            const recent = moves.filter((entry) => event.timeStamp - entry.time <= THROW_WINDOW);
            const first = recent[0];
            const last = recent[recent.length - 1];
            if (first && last && last.time > first.time) {
                const speed = (last.x - first.x) / (last.time - first.time);
                throwAt(Math.max(-MAX_THROW, Math.min(MAX_THROW, speed)));
            }
        };

        const click = (event: MouseEvent) => {
            if (swallowClick) {
                swallowClick = false;
                event.preventDefault();
                event.stopPropagation();
            }
        };

        // A sideways swipe on a trackpad, or Shift with the wheel.
        const wheel = (event: WheelEvent) => {
            if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || !animations().length) {
                return;
            }
            event.preventDefault();
            stopGlide();
            shift(-event.deltaX * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1));
        };

        // Otherwise the browser drags the link or the photo away.
        const nativeDrag = (event: DragEvent) => event.preventDefault();

        element.addEventListener('pointerdown', down);
        element.addEventListener('pointermove', move);
        element.addEventListener('pointerup', release);
        element.addEventListener('pointercancel', release);
        element.addEventListener('click', click, true);
        element.addEventListener('wheel', wheel, {passive: false});
        element.addEventListener('dragstart', nativeDrag);

        return () => {
            element.removeEventListener('pointerdown', down);
            element.removeEventListener('pointermove', move);
            element.removeEventListener('pointerup', release);
            element.removeEventListener('pointercancel', release);
            element.removeEventListener('click', click, true);
            element.removeEventListener('wheel', wheel);
            element.removeEventListener('dragstart', nativeDrag);
            stopGlide();
            if (dragging) {
                endDrag();
            }
        };
    }, [scroller, track, active]);
};
