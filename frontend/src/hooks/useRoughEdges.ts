import {useCallback, useRef} from "react";
import {roughEdgeClipPath} from "../utilites/roughEdge.ts";

// Ce qui se coupe sous la racine: les blocs marques data-rough, et tous les champs et
// boutons Mantine (ceux des questions de la caisse arrivent apres coup).
const SELECTOR = '[data-rough], .mantine-Input-input, .mantine-Button-root, .mantine-ActionIcon-root';
// Les boutons bouillonnent au survol entre trois coupes, comme ceux du site d'accueil.
const BUTTON = '[data-rough="button"], .mantine-Button-root, .mantine-ActionIcon-root';
const OUTLINES = 3;

// Les reglages du site d'accueil selon le plus petit cote: une pastille a de petites
// marches serrees, une grande carte de plus grandes, plus espacees.
const cutFor = (size: number) => {
    if (size < 48) {
        return {amplitude: 1, step: 14};
    }
    if (size < 160) {
        return {amplitude: 1.2, step: 36};
    }
    return size < 480 ? {amplitude: 1.8, step: 36} : {amplitude: 2, step: 54};
};

const clear = (element: HTMLElement) => {
    element.style.clipPath = '';
    for (let i = 0; i < OUTLINES; i++) {
        element.style.removeProperty(`--rough-clip${i ? `-${i + 1}` : ''}`);
    }
};

/**
 * Les bords decoupes a la main du site d'accueil (useRoughEdge), pour toute une page:
 * la racine recoit ce callback ref, et chaque element vise en dessous est coupe a sa
 * taille, redecoupe quand il change de taille, y compris ceux ajoutes plus tard.
 * Un element aux coins inegaux (24px 24px 0 0) ou sans coins reste lisse.
 */
export const useRoughEdges = <T extends HTMLElement>() => {
    const cleanup = useRef<() => void>();

    return useCallback((root: T | null) => {
        cleanup.current?.();
        cleanup.current = undefined;

        if (!root || typeof ResizeObserver === 'undefined' || typeof MutationObserver === 'undefined') {
            return;
        }

        const cuts = new WeakMap<Element, { seed: number, drawn: string }>();

        const draw = (element: HTMLElement, entry: ResizeObserverEntry) => {
            const cut = cuts.get(element);
            if (!cut || !element.isConnected) {
                resizes.unobserve(element);
                cuts.delete(element);
                return;
            }

            const box = entry.borderBoxSize?.[0];
            const width = box?.inlineSize ?? element.offsetWidth;
            const height = box?.blockSize ?? element.offsetHeight;
            const style = getComputedStyle(element);
            const corners = [style.borderTopLeftRadius, style.borderTopRightRadius,
                style.borderBottomRightRadius, style.borderBottomLeftRadius];
            const radius = parseFloat(corners[0]) || 0;
            const key = `${Math.round(width * 2)}x${Math.round(height * 2)}x${corners.join(' ')}`;

            if (width <= 0 || height <= 0 || key === cut.drawn) {
                return;
            }
            cut.drawn = key;

            if (!radius || corners.some((corner) => corner !== corners[0])) {
                clear(element);
                return;
            }

            // Une bordure garde son trait: la coupe n'en mord jamais plus que les trois quarts.
            const options = {radius, ...cutFor(Math.min(width, height))};
            const border = parseFloat(style.borderTopWidth) || 0;
            if (border > 0 && !style.borderTopColor.endsWith(', 0)') && style.borderTopColor !== 'transparent') {
                options.amplitude = Math.min(options.amplitude, border * 0.75);
            }
            if (element.matches(BUTTON)) {
                for (let i = 0; i < OUTLINES; i++) {
                    element.style.setProperty(`--rough-clip${i ? `-${i + 1}` : ''}`,
                        roughEdgeClipPath(width, height, {...options, seed: cut.seed + i * 104729}));
                }
                element.style.clipPath = 'var(--rough-clip)';
            } else {
                element.style.clipPath = roughEdgeClipPath(width, height, {...options, seed: cut.seed});
            }
        };

        const resizes = new ResizeObserver((entries) => {
            entries.forEach((entry) => draw(entry.target as HTMLElement, entry));
        });

        let frame = 0;
        const scan = () => {
            frame = 0;
            root.querySelectorAll(SELECTOR).forEach((element) => {
                if (!cuts.has(element)) {
                    cuts.set(element, {seed: Math.floor(Math.random() * 2 ** 32), drawn: ''});
                    resizes.observe(element);
                }
            });
        };
        // Un rendu React ajoute souvent plusieurs elements d'un coup: un seul passage par image.
        const mutations = new MutationObserver(() => {
            frame ||= requestAnimationFrame(scan);
        });

        scan();
        mutations.observe(root, {childList: true, subtree: true});

        cleanup.current = () => {
            cancelAnimationFrame(frame);
            mutations.disconnect();
            resizes.disconnect();
        };
    }, []);
};
