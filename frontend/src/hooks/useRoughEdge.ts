import {useCallback, useRef} from "react";
import {roughEdgeClipPath} from "../utilites/roughEdge.ts";

interface UseRoughEdgeOptions {
    amplitude?: number;
    step?: number;
}

/**
 * Clips an element to a hand-cut version of its own rounded box. The corner
 * radius is read from the element's CSS, and the edge is redrawn when the
 * element resizes. Returns a callback ref.
 */
export const useRoughEdge = <T extends HTMLElement>({amplitude = 1.5, step = 40}: UseRoughEdgeOptions = {}) => {
    const observer = useRef<ResizeObserver | null>(null);
    const seed = useRef(Math.floor(Math.random() * 2 ** 32));

    return useCallback((element: T | null) => {
        observer.current?.disconnect();
        observer.current = null;

        if (!element || typeof ResizeObserver === 'undefined') {
            return;
        }

        let drawn = '';
        observer.current = new ResizeObserver((entries) => {
            const box = entries[0]?.borderBoxSize?.[0];
            const width = box?.inlineSize ?? element.offsetWidth;
            const height = box?.blockSize ?? element.offsetHeight;
            const radius = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
            const key = `${Math.round(width * 2)}x${Math.round(height * 2)}x${radius}`;

            if (width <= 0 || height <= 0 || key === drawn) {
                return;
            }
            drawn = key;

            element.style.clipPath = radius
                ? roughEdgeClipPath(width, height, {radius, step, amplitude, seed: seed.current})
                : '';
        });
        observer.current.observe(element);
    }, [amplitude, step]);
};
