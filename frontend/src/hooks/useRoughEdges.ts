import {useEffect} from "react";
import {roughClipPath, roughEdgeClipPath, roughEdgePath} from "../utilites/roughEdge.ts";
import {ROUGH_BUTTON_BUMP, roughButtonPath} from "./useRoughButton.ts";

// Ce qui se coupe: les blocs marques data-rough, et tous les champs et boutons Mantine,
// partout (pages publiques, back-office, fenetres et menus en portail).
const SELECTOR = '[data-rough], .mantine-Input-input, .mantine-Button-root, .mantine-ActionIcon-root, .mantine-CloseButton-root';
// Les boutons prennent le contour des boutons du site (rugueux.ts: des bosses lisses, les
// bouts nets) sur leur propre rayon, et bouillonnent au survol entre trois traces.
const BUTTON = '[data-rough="button"], .mantine-Button-root, .mantine-ActionIcon-root, .mantine-CloseButton-root';
const OUTLINES = 3;
// Les reglages par defaut de v-decoupe (decoupe.ts): le bord rentre d'un pixel et demi tous
// les 40px environ, on le sent plus qu'on ne le voit. Une petite pastille, d'un pixel. Toutes
// les decoupes sont ensuite adoucies par ROUGH_INTENSITY (roughEdge.ts).
const AMPLITUDE = 1.5;
const SMALL_AMPLITUDE = 1;
// Un bloc a trait ondule comme les cases du calendrier du site (v-decoupe="{ amplitude: 1, trait: 2 }").
const STROKE_AMPLITUDE = 1;
const STEP = 40;
// Plus haut que ca, un « bouton » est une tuile (choix de l'accueil): il garde ses coins.
const PILL_MAX_HEIGHT = 80;
// La taille du bouton rond du site d'accueil (4rem), ou ses bosses sont pleines.
const ROUND_FULL_SIZE = 64;
// Au survol, une pilule grossit de 4 %, mais jamais de plus de 10px en largeur: une rangee
// pleine largeur (les actions de la commande) ne fait pas un bond de 35px.
const PILL_GROW = 0.04;
const PILL_GROW_MAX = 10;

const outlineName = (i: number) => `--rough-clip${i ? `-${i + 1}` : ''}`;
const strokeName = (i: number) => `--rough-stroke${i ? `-${i + 1}` : ''}`;

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
    delete element.dataset.roughOutlined;
    element.style.removeProperty('--rough-border');
    element.style.removeProperty('--rough-border-color');
    element.style.removeProperty('--rough-grow');
    for (let i = 0; i < OUTLINES; i++) {
        element.style.removeProperty(outlineName(i));
        element.style.removeProperty(strokeName(i));
    }
    if (element.dataset.roughPositioned !== undefined) {
        element.style.position = '';
        delete element.dataset.roughPositioned;
    }
};

// Un rayon en pourcentage se mesure sur le plus petit cote, comme dans decoupe.ts.
const radiusOf = (style: CSSStyleDeclaration, width: number, height: number) => {
    const value = style.borderTopLeftRadius.split(' ')[0];
    const number = parseFloat(value) || 0;
    return value.endsWith('%') ? (number / 100) * Math.min(width, height) : number;
};

interface Ring {
    width: number;
    color: string;
}

// L'epaisseur d'une bordure visible: la coupe n'en mord jamais plus que les trois quarts,
// pour que le trait reste continu.
const visibleBorder = (style: CSSStyleDeclaration) => {
    const width = parseFloat(style.borderTopWidth) || 0;
    const color = style.borderTopColor;
    return width > 0 && color !== 'transparent' && !color.endsWith(', 0)') ? width : 0;
};

/**
 * Les bords decoupes a la main du site DEHORS (dehors-shop-new: decoupe.ts pour les blocs,
 * rugueux.ts pour les boutons), pour toute l'application: chaque element vise sous la racine
 * est coupe a sa taille, redecoupe quand il change de taille, y compris ceux ajoutes plus
 * tard. Un element aux coins inegaux (24px 24px 0 0) ou sans coins reste lisse.
 *
 * Les boutons gardent leur propre fond: leur contour rugueux est tire vers l'interieur et
 * pose en clip-path, au lieu des masques de la boutique, pour que les couleurs de survol,
 * de chargement ou d'etat desactive restent celles du CSS.
 */
const cutRoughEdges = (root: HTMLElement) => {
    // ring: la bordure d'un bouton contour, lue avant qu'elle devienne transparente.
    const cuts = new WeakMap<Element, { seed: number, drawn: string, ring?: Ring | null }>();

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
        const isButton = element.matches(BUTTON);
        // Un bouton contour (bordure visible) aussi, et il bouillonne avec sa decoupe: sa
        // bordure, retenue au premier passage, est peinte le long de chacun de ses traces.
        const ring = isButton
            ? cut.ring ??= (visibleBorder(style) ? {width: visibleBorder(style), color: style.borderTopColor} : null)
            : null;
        const border = stroke || ring ? 0 : visibleBorder(style);
        const round = isButton && Math.abs(width - height) <= 2 && radius >= Math.min(width, height) / 2 - 1;
        const pill = isButton && !round && height <= PILL_MAX_HEIGHT && width >= height * 0.9;
        const boxRadius = Math.min(radius, width / 2, height / 2);

        // Le trace (pour le trait d'un bouton contour) et la coupe qu'il donne.
        const shape = (seed: number) => {
            if (round || pill) {
                // Les bosses vont de 0 a deux fois la plus grande vers l'interieur. Un petit
                // rond (le + des billets) les prend plus fines: pleines, il devenait carre.
                let scale = border ? Math.min(1, (border * 0.75) / (2 * ROUGH_BUTTON_BUMP)) : 1;
                if (round) {
                    scale *= Math.min(1, Math.min(width, height) / ROUND_FULL_SIZE) ** 2;
                }
                const path = roughButtonPath(width, height, seed, {radius: boxRadius, round, scale});
                return {path, clip: roughClipPath(width, height, boxRadius, path)};
            }
            let amplitude = Math.min(width, height) < 40 ? SMALL_AMPLITUDE : AMPLITUDE;
            if (border) {
                amplitude = Math.min(amplitude, border * 0.75);
            }
            const options = {radius, step: STEP, amplitude, seed};
            return {path: roughEdgePath(width, height, options), clip: roughEdgeClipPath(width, height, options)};
        };

        element.dataset.roughCut = '';
        if (isButton) {
            for (let i = 0; i < OUTLINES; i++) {
                const {path, clip} = shape(cut.seed + i * 104729);
                element.style.setProperty(outlineName(i), clip);
                if (ring) {
                    element.style.setProperty(strokeName(i), strokeMask(width, height, path, ring.width));
                }
            }
            if (ring) {
                element.dataset.roughOutlined = '';
                element.style.setProperty('--rough-border', `${ring.width}px`);
                element.style.setProperty('--rough-border-color', ring.color);
                // Le trait (::after) se place sur le bouton.
                if (style.position === 'static') {
                    element.style.position = 'relative';
                    element.dataset.roughPositioned = '';
                }
            }
            element.dataset.roughBoil = round || pill ? 'pill' : 'tile';
            element.style.setProperty('--rough-grow', (1 + Math.min(PILL_GROW, PILL_GROW_MAX / width)).toFixed(4));
            element.style.clipPath = 'var(--rough-clip)';
        } else if (stroke) {
            const options = {radius, step: STEP, amplitude: STROKE_AMPLITUDE, seed: cut.seed};
            element.style.clipPath = roughEdgeClipPath(width, height, options);
            element.style.setProperty('--rough-stroke', strokeMask(width, height, roughEdgePath(width, height, options), stroke));
            element.style.setProperty('--rough-border', `${stroke}px`);
        } else {
            element.style.clipPath = shape(cut.seed).clip;
        }
    };

    const resizes = new ResizeObserver((entries) => {
        entries.forEach((entry) => draw(entry.target as HTMLElement, entry));
    });

    const watch = (element: Element) => {
        if (!cuts.has(element)) {
            cuts.set(element, {seed: Math.floor(Math.random() * 2 ** 32), drawn: ''});
            resizes.observe(element);
        }
    };

    // Un rendu React ajoute souvent plusieurs elements d'un coup: un seul passage par image,
    // sur ce qui vient d'arriver seulement.
    const added = new Set<Element>();
    let frame = 0;
    const scan = () => {
        frame = 0;
        added.forEach((node) => {
            if (node.isConnected) {
                if (node.matches(SELECTOR)) {
                    watch(node);
                }
                node.querySelectorAll(SELECTOR).forEach(watch);
            }
        });
        added.clear();
    };
    const mutations = new MutationObserver((records) => {
        records.forEach((record) => record.addedNodes.forEach((node) => {
            if (node instanceof Element) {
                added.add(node);
            }
        }));
        if (added.size) {
            frame ||= requestAnimationFrame(scan);
        }
    });

    root.querySelectorAll(SELECTOR).forEach(watch);
    mutations.observe(root, {childList: true, subtree: true});

    return () => {
        cancelAnimationFrame(frame);
        mutations.disconnect();
        resizes.disconnect();
    };
};

// Pose une fois, a la racine de l'application: tout le document, portails compris.
export const useRoughEdges = () => {
    useEffect(() => {
        if (typeof ResizeObserver === 'undefined' || typeof MutationObserver === 'undefined') {
            return;
        }
        return cutRoughEdges(document.body);
    }, []);
};
