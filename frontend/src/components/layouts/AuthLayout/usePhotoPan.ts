import {RefObject, useEffect} from "react";

// The photo is zoomed in its frame (.photoImage), and pans up to PAN % of its size each way, within the zoom's overflow.
const ZOOM = 1.08;
const PAN = 3.5;
// Share of the remaining way covered at each frame: the lower, the softer.
const EASING = 0.08;

/**
 * Pans the photo a little inside its frame as the mouse moves across the
 * screen, toward the side the cursor points to, like the shop's event cards.
 * Back to the centre when the mouse leaves the window. Mouse only, and off
 * under reduced motion.
 */
export const usePhotoPan = (photo: RefObject<HTMLElement>) => {
    useEffect(() => {
        const element = photo.current;
        if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        const state = {x: 0, y: 0, targetX: 0, targetY: 0};
        let frame: number | null = null;

        const animate = () => {
            frame = null;
            state.x += (state.targetX - state.x) * EASING;
            state.y += (state.targetY - state.y) * EASING;
            const arrived = Math.abs(state.targetX - state.x) < 0.005 && Math.abs(state.targetY - state.y) < 0.005;
            if (arrived) {
                state.x = state.targetX;
                state.y = state.targetY;
            }
            element.style.transform = `translate(${state.x.toFixed(3)}%, ${state.y.toFixed(3)}%) scale(${ZOOM})`;
            if (!arrived) {
                frame = requestAnimationFrame(animate);
            }
        };

        const aim = (x: number, y: number) => {
            state.targetX = x;
            state.targetY = y;
            if (frame === null) {
                frame = requestAnimationFrame(animate);
            }
        };

        const follow = (event: PointerEvent) => {
            if (event.pointerType !== 'mouse' || !element.offsetWidth) {
                return;
            }
            // The cursor on the screen, from -0.5 to 0.5: the photo slides the other way.
            const x = event.clientX / window.innerWidth - 0.5;
            const y = event.clientY / window.innerHeight - 0.5;
            aim(-x * 2 * PAN, -y * 2 * PAN);
        };
        const recentre = (event: MouseEvent) => {
            if (!event.relatedTarget) {
                aim(0, 0);
            }
        };

        window.addEventListener('pointermove', follow, {passive: true});
        document.addEventListener('mouseout', recentre);

        return () => {
            window.removeEventListener('pointermove', follow);
            document.removeEventListener('mouseout', recentre);
            if (frame !== null) {
                cancelAnimationFrame(frame);
            }
            element.style.removeProperty('transform');
        };
    }, [photo]);
};
