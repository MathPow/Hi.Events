import {useEffect, useRef} from "react";

const MAX_FADE_PX = 56;

// Pairs with the scroll-fade mixin (_nav.scss): a list fades out at the edges it continues past, and
// the fade shrinks to nothing as the list reaches that edge.
export const useScrollFade = <T extends HTMLElement>(active = true) => {
    const ref = useRef<T>(null);

    useEffect(() => {
        const element = ref.current;

        if (!active || !element) {
            return;
        }

        const setFade = (edge: 'top' | 'bottom', distance: number) => {
            const fade = Math.min(Math.max(distance, 0), MAX_FADE_PX);
            element.style.setProperty(`--scroll-fade-${edge}`, `${fade}px`);
        };

        const update = () => {
            setFade('top', element.scrollTop);
            setFade('bottom', element.scrollHeight - element.clientHeight - element.scrollTop);
        };

        // The list's height comes from its content: rows load, labels wrap, the sidebar folds.
        const resizeObserver = new ResizeObserver(update);
        const observeContent = () => {
            resizeObserver.disconnect();
            resizeObserver.observe(element);
            Array.from(element.children).forEach((child) => resizeObserver.observe(child));
        };
        const mutationObserver = new MutationObserver(observeContent);

        observeContent();
        mutationObserver.observe(element, {childList: true});
        element.addEventListener('scroll', update, {passive: true});

        return () => {
            element.removeEventListener('scroll', update);
            mutationObserver.disconnect();
            resizeObserver.disconnect();
        };
    }, [active]);

    return ref;
};
