import {useEffect, useLayoutEffect, useRef, useState} from "react";

// The PDF is A4 portrait with 20 mm at the top and 18 mm on the other sides (documents/pdf.blade.php).
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_TOP_MM = 20;
const MARGIN_SIDE_MM = 18;
const MARGIN_BOTTOM_MM = 18;
export const PAGE_GAP = 24;

export interface PaperPages {
    // How far each block is pushed down so it starts on the next page instead of crossing its bottom.
    pushes: Record<string, number>;
    pageCount: number;
    pageHeight: number;
    marginTop: number;
    marginSide: number;
}

export interface PaperPagesResult extends PaperPages {
    paperRef: (element: HTMLDivElement | null) => void;
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const samePages = (a: PaperPages, b: PaperPages) =>
    a.pageCount === b.pageCount && a.pageHeight === b.pageHeight && a.marginSide === b.marginSide
    && JSON.stringify(a.pushes) === JSON.stringify(b.pushes);

/**
 * The editor's sheet cut into A4 pages, like the exported PDF: the children of the paper marked
 * with data-page-item are laid out page by page, a block that would cross the bottom margin
 * starting on the next page. The editor's text is larger than the PDF's, so the breaks are a guide.
 */
export const usePaperPages = (): PaperPagesResult => {
    const [paper, setPaper] = useState<HTMLDivElement | null>(null);
    const [pages, setPages] = useState<PaperPages>({pushes: {}, pageCount: 1, pageHeight: 0, marginTop: 0, marginSide: 0});
    const applied = useRef(pages);
    applied.current = pages;

    const measure = useRef(() => {});
    measure.current = () => {
        if (!paper || !paper.clientWidth) {
            return;
        }
        const mm = paper.clientWidth / PAGE_WIDTH_MM;
        const pageHeight = PAGE_HEIGHT_MM * mm;
        const stride = pageHeight + PAGE_GAP;
        const marginTop = MARGIN_TOP_MM * mm;
        const marginBottom = MARGIN_BOTTOM_MM * mm;

        const pushes: Record<string, number> = {};
        let appliedSoFar = 0;
        let shift = 0;
        let end = 0;
        paper.querySelectorAll<HTMLElement>(':scope > [data-page-item]').forEach(item => {
            const key = item.dataset.pageItem as string;
            appliedSoFar += applied.current.pushes[key] ?? 0;
            const top = item.offsetTop - appliedSoFar + shift;
            const page = Math.floor(top / stride);
            const pageTop = page * stride + marginTop;
            const contentBottom = page * stride + pageHeight - marginBottom;
            if (top + item.offsetHeight > contentBottom && top > pageTop + 1) {
                const push = Math.round((page + 1) * stride + marginTop - top);
                pushes[key] = push;
                shift += push;
            }
            end = Math.max(end, top + (pushes[key] ?? 0) + item.offsetHeight);
        });

        const next: PaperPages = {
            pushes,
            pageCount: Math.max(1, Math.ceil((end + marginBottom) / stride)),
            pageHeight: Math.round(pageHeight),
            marginTop: Math.round(marginTop),
            marginSide: Math.round(MARGIN_SIDE_MM * mm),
        };
        if (!samePages(next, applied.current)) {
            setPages(next);
        }
    };

    useIsomorphicLayoutEffect(() => measure.current());

    useEffect(() => {
        if (!paper || typeof ResizeObserver === 'undefined') {
            return;
        }
        const observer = new ResizeObserver(() => measure.current());
        const observeAll = () => {
            observer.disconnect();
            observer.observe(paper);
            paper.querySelectorAll(':scope > [data-page-item]').forEach(item => observer.observe(item));
        };
        observeAll();
        // Blocks come and go: watch the new ones too.
        const mutations = new MutationObserver(observeAll);
        mutations.observe(paper, {childList: true});

        return () => {
            observer.disconnect();
            mutations.disconnect();
        };
    }, [paper]);

    return {...pages, paperRef: setPaper};
};
