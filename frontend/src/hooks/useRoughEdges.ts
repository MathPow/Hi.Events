import {useCallback, useRef} from "react";
import {roughClipPath, roughEdgeClipPath, roughEdgePath} from "../utilites/roughEdge.ts";
import {ROUGH_BUTTON_BUMP, roughButtonPath} from "./useRoughButton.ts";

// Ce qui se coupe sous la racine: les blocs marques data-rough, et tous les champs et
// boutons Mantine (ceux des questions de la caisse arrivent apres coup).
const SELECTOR = '[data-rough], .mantine-Input-input, .mantine-Button-root, .mantine-ActionIcon-root';
// Les boutons prennent le contour des boutons du site (rugueux.ts: des bosses lisses, les
// bouts nets) sur leur propre rayon, et bouillonnent au survol entre trois traces.
const BUTTON = '[data-rough="button"], .mantine-Button-root, .mantine-ActionIcon-root';
const OUTLINES = 3;
// Les reglages par defaut de v-decoupe (decoupe.ts): le bord rentre d'un pixel et demi tous
// les 40px environ, on le sent plus qu'on ne le voit. Une petite pastille, d'un pixel.
const AMPLITUDE = 1.5;
const SMALL_AMPLITUDE = 1;
const STEP = 40;
// Plus haut que ca, un « bouton » est une tuile (choix de l'accueil): il garde ses coins.
const PILL_MAX_HEIGHT = 80;
// La taille du bouton rond du site d'accueil (4rem), ou ses bosses sont pleines.
const ROUND_FULL_SIZE = 64;

const outlineName = (i: number) => `--rough-clip${i ? `-${i + 1}` : ''}`;

// Le trait de decoupe.ts (option trait): le meme trace en contour, en masque. Centre sur le
// bord, on le trace deux fois plus epais et on n'en garde que la moitie interieure: la
// decoupe ne mord que le long des cotes, la moitie exterieure debordait dans les coins.
const strokeMask = (width: number, height: number, path: string, thickness: number) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(1)} ${height.toFixed(1)}" preserveAspectRatio="none">`
        + `<clipPath id="c"><path d="${path}"/></clipPath>`
        + `<path d="${path}" fill="none" stroke="#000" stroke-width="${thickness * 2}" clip-path="url(#c)"/></svg>`;
    return `url("data:image/svg+xml;base64,${btoa(svg)}")`;
};

const clear = (element: HTMLElement) => {
    element.style.clipPath = '';
    delete element.dataset.roughCut;
    delete element.dataset.roughBoil;
    element.style.removeProperty('--rough-stroke');
    element.style.removeProperty('--rough-border');
    for (let i = 0; i < OUTLINES; i++) {
        element.style.removeProperty(outlineName(i));
    }
};

// Un rayon en pourcentage se mesure sur le plus petit cote, comme dans decoupe.ts.
const radiusOf = (style: CSSStyleDeclaration, width: number, height: number) => {
    const value = style.borderTopLeftRadius.split(' ')[0];
    const number = parseFloat(value) || 0;
    return value.endsWith('%') ? (number / 100) * Math.min(width, height) : number;
};

// L'epaisseur d'une bordure visible: la coupe n'en mord jamais plus que les trois quarts,
// pour que le trait reste continu.
const visibleBorder = (style: CSSStyleDeclaration) => {
    const width = parseFloat(style.borderTopWidth) || 0;
    const color = style.borderTopColor;
    return width > 0 && color !== 'transparent' && !color.endsWith(', 0)') ? width : 0;
};

/**
 * Les bords decoupes a la main du site DEHORS (dehors-shop-new: decoupe.ts pour les blocs,
 * rugueux.ts pour les boutons), pour toute une page: la racine recoit ce callback ref, et
 * chaque element vise en dessous est coupe a sa taille, redecoupe quand il change de
 * taille, y compris ceux ajoutes plus tard. Un element aux coins inegaux (24px 24px 0 0)
 * ou sans coins reste lisse.
 *
 * Les boutons gardent leur propre fond: leur contour rugueux est tire vers l'interieur et
 * pose en clip-path, au lieu des masques de la boutique, pour que les couleurs de survol,
 * de chargement ou d'etat desactive restent celles du CSS.
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
            const radius = radiusOf(style, width, height);
            const key = `${Math.round(width * 2)}x${Math.round(height * 2)}x${corners.join(' ')}`;

            if (width <= 0 || height <= 0 || key === cut.drawn) {
                return;
            }
            cut.drawn = key;

            if (!radius || corners.some((corner) => corner !== corners[0])) {
                clear(element);
                return;
            }

            // Un bloc a trait (data-rough="stroke") peint sa bordure le long du bord decoupe:
            // la coupe n'a pas a l'epargner. Sa bordure CSS, devenue transparente, en donne
            // l'epaisseur.
            const stroke = element.dataset.rough === 'stroke' ? parseFloat(style.borderTopWidth) || 0 : 0;
            const border = stroke ? 0 : visibleBorder(style);
            const isButton = element.matches(BUTTON);
            const round = isButton && Math.abs(width - height) <= 2 && radius >= Math.min(width, height) / 2 - 1;
            const pill = isButton && !round && height <= PILL_MAX_HEIGHT && width >= height * 0.9;
            const boxRadius = Math.min(radius, width / 2, height / 2);

            const outline = (seed: number) => {
                if (round || pill) {
                    // Les bosses vont de 0 a deux fois la plus grande vers l'interieur. Un petit
                    // rond (le + des billets) les prend plus fines: pleines, il devenait carre.
                    let scale = border ? Math.min(1, (border * 0.75) / (2 * ROUGH_BUTTON_BUMP)) : 1;
                    if (round) {
                        scale *= Math.min(1, Math.min(width, height) / ROUND_FULL_SIZE) ** 2;
                    }
                    const path = roughButtonPath(width, height, seed, {radius: boxRadius, round, scale});
                    return roughClipPath(width, height, boxRadius, path);
                }
                let amplitude = Math.min(width, height) < 40 ? SMALL_AMPLITUDE : AMPLITUDE;
                if (border) {
                    amplitude = Math.min(amplitude, border * 0.75);
                }
                return roughEdgeClipPath(width, height, {radius, step: STEP, amplitude, seed});
            };

            element.dataset.roughCut = '';
            if (isButton) {
                for (let i = 0; i < OUTLINES; i++) {
                    element.style.setProperty(outlineName(i), outline(cut.seed + i * 104729));
                }
                element.dataset.roughBoil = round || pill ? 'pill' : 'tile';
                element.style.clipPath = 'var(--rough-clip)';
            } else if (stroke) {
                const options = {radius, step: STEP, amplitude: AMPLITUDE, seed: cut.seed};
                element.style.clipPath = roughEdgeClipPath(width, height, options);
                element.style.setProperty('--rough-stroke', strokeMask(width, height, roughEdgePath(width, height, options), stroke));
                element.style.setProperty('--rough-border', `${stroke}px`);
            } else {
                element.style.clipPath = outline(cut.seed);
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
