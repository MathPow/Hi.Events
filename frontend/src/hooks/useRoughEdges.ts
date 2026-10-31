import {useEffect} from "react";
import {roughClipPath, roughEdgeClipPath, roughEdgePath} from "../utilites/roughEdge.ts";
import {roughButtonPath} from "./useRoughButton.ts";

// Ce qui se coupe: les blocs marques data-rough, tous les champs et boutons Mantine, les
// fenetres et les notifications, partout (pages publiques, back-office, portails).
const SELECTOR = '[data-rough], .mantine-Input-input, .mantine-Button-root, .mantine-ActionIcon-root, .mantine-CloseButton-root,'
    + ' .mantine-Modal-content, .mantine-Notification-root';
// Les boutons pleins prennent le contour des boutons du site (rugueux.ts: des bosses lisses,
// les bouts nets) sur leur propre rayon, les boutons contour celui des blocs; tous
// bouillonnent au survol entre trois traces.
const BUTTON = '[data-rough="button"], .mantine-Button-root, .mantine-ActionIcon-root, .mantine-CloseButton-root';
// Un champ n'a pas de ::after pour repeindre son trait: l'enveloppe de Mantine qui le tient
// (positionnee, de sa taille) le fait a sa place.
const FIELD = 'input, textarea, select';
const FIELD_HOST = '.mantine-Input-wrapper';
// Ce qui colore la bordure d'un champ apres coup.
const FIELD_STATES = ['data-error', 'aria-invalid', 'disabled', 'data-disabled'];
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
    element.style.removeProperty('--rough-grow');
    for (let i = 0; i < OUTLINES; i++) {
        element.style.removeProperty(outlineName(i));
        element.style.removeProperty(strokeName(i));
    }
    if (element.dataset.roughPositioned !== undefined) {
        element.style.position = '';
        delete element.dataset.roughPositioned;
    }
    const host = element.matches(FIELD) ? element.parentElement : null;
    if (host?.dataset.roughRing !== undefined) {
        delete host.dataset.roughRing;
        ['--rough-ring', '--rough-ring-x', '--rough-ring-y', '--rough-ring-w', '--rough-ring-h',
            '--rough-ring-color', '--rough-ring-opacity'].forEach((name) => host.style.removeProperty(name));
    }
};

// La couleur et l'opacite de la bordure d'un champ, que son enveloppe repeint: lues sans sa
// transition, l'erreur s'affiche d'un coup, trait repeint compris.
const syncRing = (field: HTMLElement) => {
    const host = field.parentElement;
    if (host?.dataset.roughRing === undefined) {
        return;
    }
    const transition = field.style.transition;
    field.style.transition = 'none';
    const style = getComputedStyle(field);
    host.style.setProperty('--rough-ring-color', style.borderTopColor);
    host.style.setProperty('--rough-ring-opacity', style.opacity);
    field.style.transition = transition;
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
 * rugueux.ts pour les boutons), pour toute l'application: chaque element vise sous la racine
 * est coupe a sa taille, redecoupe quand il change de taille, y compris ceux ajoutes plus
 * tard. Un element aux coins inegaux (24px 24px 0 0) ou sans coins reste lisse.
 *
 * Les boutons gardent leur propre fond: leur contour rugueux est tire vers l'interieur et
 * pose en clip-path, au lieu des masques de la boutique, pour que les couleurs de survol,
 * de chargement ou d'etat desactive restent celles du CSS.
 */
const cutRoughEdges = (root: HTMLElement) => {
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

        clear(element);
        if (!radius || corners.some((corner) => corner !== corners[0])) {
            return;
        }

        // Un bloc a trait (data-rough="stroke") peint sa bordure le long du bord decoupe:
        // la coupe n'a pas a l'epargner. Sa bordure CSS, devenue transparente, en donne
        // l'epaisseur.
        const stroke = element.dataset.rough === 'stroke' ? parseFloat(style.borderTopWidth) || 0 : 0;
        const isButton = element.matches(BUTTON);
        const border = stroke ? 0 : visibleBorder(style);
        // L'epaisseur de la bordure, meme transparente: elle peut se colorer plus tard (une
        // erreur, le focus, le survol), et son trait repeint avec elle.
        const borderWidth = stroke ? 0 : parseFloat(style.borderTopWidth) || 0;
        const field = element.matches(FIELD);
        const round = isButton && Math.abs(width - height) <= 2 && radius >= Math.min(width, height) / 2 - 1;
        const pill = isButton && !round && height <= PILL_MAX_HEIGHT && width >= height * 0.9;
        const boxRadius = Math.min(radius, width / 2, height / 2);

        // Un bouton plein prend les bosses des boutons du site. Un bouton contour (bordure
        // visible) se coupe comme un bloc borde, les onglets de l'organisateur: de petites
        // ondulations qui mordent a peine sa propre bordure, et il bouillonne entre trois.
        const edge = (seed: number) => {
            let amplitude = Math.min(width, height) < 40 ? SMALL_AMPLITUDE : AMPLITUDE;
            if (border) {
                amplitude = Math.min(amplitude, border * 0.75);
            }
            return {radius, step: STEP, amplitude, seed};
        };
        // Le trace d'une coupe, et la coupe qu'il donne.
        const shape = (seed: number) => {
            if ((round || pill) && !border) {
                // Un petit rond (le + des billets) prend des bosses plus fines: pleines, il
                // devenait carre.
                const scale = round ? Math.min(1, Math.min(width, height) / ROUND_FULL_SIZE) ** 2 : 1;
                const path = roughButtonPath(width, height, seed, {radius: boxRadius, round, scale});
                return {path, clip: roughClipPath(width, height, boxRadius, path)};
            }
            const options = edge(seed);
            return {path: roughEdgePath(width, height, options), clip: roughEdgeClipPath(width, height, options)};
        };

        // La coupe ronge la bordure par endroits: le trait s'amincissait et devenait flou la ou
        // elle mordait. Il est donc repeint le long de la coupe, de l'epaisseur de la bordure
        // (--rough-stroke), par ::after (dehors-app.scss), ou par l'enveloppe d'un champ: la
        // bordure reste dessous, et le trait garde partout la meme epaisseur.
        // Une bordure encore transparente ne vaut pas de repositionner l'element (ses enfants
        // places pourraient s'y rattacher): seulement s'il l'est deja.
        const ring = (path: string) => strokeMask(width, height, path, borderWidth);
        const outlined = borderWidth > 0 && !field && (border > 0 || style.position !== 'static');
        if (outlined) {
            element.dataset.roughOutlined = '';
            element.style.setProperty('--rough-border', `${borderWidth}px`);
            if (style.position === 'static') {
                element.style.position = 'relative';
                element.dataset.roughPositioned = '';
            }
        }

        const ringField = (path: string) => {
            const host = element.parentElement;
            if (!host?.matches(FIELD_HOST) || getComputedStyle(host).position === 'static') {
                return;
            }
            const [a, b] = [element.getBoundingClientRect(), host.getBoundingClientRect()];
            host.dataset.roughRing = '';
            host.style.setProperty('--rough-ring', ring(path));
            host.style.setProperty('--rough-ring-x', `${a.left - b.left - host.clientLeft}px`);
            host.style.setProperty('--rough-ring-y', `${a.top - b.top - host.clientTop}px`);
            host.style.setProperty('--rough-ring-w', `${width}px`);
            host.style.setProperty('--rough-ring-h', `${height}px`);
            syncRing(element);
        };

        element.dataset.roughCut = '';
        if (isButton) {
            for (let i = 0; i < OUTLINES; i++) {
                const {path, clip} = shape(cut.seed + i * 104729);
                element.style.setProperty(outlineName(i), clip);
                if (outlined) {
                    element.style.setProperty(strokeName(i), ring(path));
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
            const {path, clip} = shape(cut.seed);
            element.style.clipPath = clip;
            if (outlined) {
                element.style.setProperty(strokeName(0), ring(path));
            } else if (field && borderWidth) {
                ringField(path);
            }
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
        records.forEach((record) => {
            if (record.type === 'attributes') {
                if (record.target instanceof HTMLElement && record.target.matches(FIELD)) {
                    syncRing(record.target);
                }
                return;
            }
            record.addedNodes.forEach((node) => {
                if (node instanceof Element) {
                    added.add(node);
                }
            });
        });
        if (added.size) {
            frame ||= requestAnimationFrame(scan);
        }
    });

    // Le focus colore aussi la bordure d'un champ, selon le theme.
    const onFocus = (event: FocusEvent) => {
        if (event.target instanceof HTMLElement && event.target.matches(FIELD)) {
            syncRing(event.target);
        }
    };

    root.querySelectorAll(SELECTOR).forEach(watch);
    mutations.observe(root, {childList: true, subtree: true, attributes: true, attributeFilter: FIELD_STATES});
    root.addEventListener('focusin', onFocus);
    root.addEventListener('focusout', onFocus);

    return () => {
        cancelAnimationFrame(frame);
        mutations.disconnect();
        resizes.disconnect();
        root.removeEventListener('focusin', onFocus);
        root.removeEventListener('focusout', onFocus);
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
