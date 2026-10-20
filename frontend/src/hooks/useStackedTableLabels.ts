import {RefObject, useEffect} from "react";

// Copies each column header onto its cells as data-label, so phones can show rows as stacked cards
// (see the stacked-table mixin) without every table repeating its headers.
export const useStackedTableLabels = (tableRef: RefObject<HTMLTableElement | null>) => {
    useEffect(() => {
        const table = tableRef.current;
        if (!table || typeof MutationObserver === 'undefined') {
            return;
        }

        const applyLabels = () => {
            const headers = Array.from(table.querySelectorAll('thead th'), (th) => th.textContent?.trim() ?? '');

            table.querySelectorAll('tbody tr').forEach((row) => {
                let column = 0;
                Array.from(row.children).forEach((cell) => {
                    const span = (cell as HTMLTableCellElement).colSpan || 1;
                    const label = span === 1 ? headers[column] : '';
                    if (label) {
                        cell.setAttribute('data-label', label);
                    } else {
                        cell.removeAttribute('data-label');
                    }
                    column += span;
                });
            });
        };

        applyLabels();
        const observer = new MutationObserver(applyLabels);
        observer.observe(table, {childList: true, subtree: true, characterData: true});

        return () => observer.disconnect();
    }, [tableRef]);
};
