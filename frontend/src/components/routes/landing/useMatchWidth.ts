import {RefObject, useEffect} from "react";

/** Widest rendered line of an element's text. */
const widestLine = (element: HTMLElement) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const lines = new Map<number, { left: number, right: number }>();
    for (const rect of range.getClientRects()) {
        const top = Math.round(rect.top);
        const line = lines.get(top) ?? {left: Infinity, right: -Infinity};
        line.left = Math.min(line.left, rect.left);
        line.right = Math.max(line.right, rect.right);
        lines.set(top, line);
    }
    return Math.max(0, ...[...lines.values()].map(({left, right}) => right - left));
};

/**
 * Scales the font of `line` (a single unwrapped line) so it spans exactly the
 * widest line of `reference`. Both are measured on screen, so a transform
 * shared by both (a reveal animation) doesn't change the ratio.
 */
export const useMatchWidth = (reference: RefObject<HTMLElement | null>, line: RefObject<HTMLElement | null>) => {
    useEffect(() => {
        const fit = () => {
            if (!reference.current || !line.current) {
                return;
            }
            const target = widestLine(reference.current);
            const width = line.current.getBoundingClientRect().width;
            const size = parseFloat(getComputedStyle(line.current).fontSize);
            if (target && width) {
                line.current.style.fontSize = `${(size * target / width).toFixed(2)}px`;
            }
        };

        fit();
        document.fonts?.ready.then(fit);
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
        if (reference.current) {
            observer?.observe(reference.current);
        }

        return () => observer?.disconnect();
    }, [reference, line]);
};
