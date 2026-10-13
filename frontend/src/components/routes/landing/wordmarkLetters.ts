/**
 * Inlines a hand-drawn wordmark SVG and tags each letter with `class="letter"`
 * and its reading order in `--rank`, so CSS can raise the letters one by one.
 * A letter made of several paths (the O and its mountain) keeps them together:
 * a path at least half covered, in width, by the previous letter belongs to it.
 */
const cache = new Map<string, Promise<string>>();

const prepare = async (url: string): Promise<string> => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Wordmark not found: ${url}`);
    }

    const svg = new DOMParser().parseFromString(await response.text(), 'image/svg+xml').documentElement;
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.removeAttribute('style');
    [svg, ...svg.querySelectorAll('[id]')].forEach((element) => element.removeAttribute('id'));

    const host = document.createElement('div');
    host.style.cssText = 'position: absolute; top: 0; left: -10000px; visibility: hidden;';
    const measured = document.importNode(svg, true) as unknown as SVGSVGElement;
    host.append(measured);
    document.body.append(host);
    const boxes = [...measured.querySelectorAll('path')].map((path) => path.getBBox());
    host.remove();

    const paths = [...svg.querySelectorAll('path')];
    const order = boxes.map((box, index) => ({index, x: box.x, width: box.width})).sort((a, b) => a.x - b.x);

    let rank = -1;
    let letterEnd = -Infinity;
    for (const {index, x, width} of order) {
        if (Math.min(x + width, letterEnd) - x < width / 2) {
            rank++;
            letterEnd = x + width;
        } else {
            letterEnd = Math.max(letterEnd, x + width);
        }
        paths[index].setAttribute('class', 'letter');
        paths[index].setAttribute('style', `--rank: ${rank}`);
    }

    return new XMLSerializer().serializeToString(svg);
};

export const loadWordmarkLetters = (url: string): Promise<string> => {
    let letters = cache.get(url);
    if (!letters) {
        letters = prepare(url);
        cache.set(url, letters);
        letters.catch(() => cache.delete(url));
    }

    return letters;
};
