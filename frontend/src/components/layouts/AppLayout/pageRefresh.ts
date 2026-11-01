import {useEffect} from "react";

/**
 * After the assistant changed something, the page in view starts again from the fresh data (its
 * forms and drafts are only filled when it opens). Pages holding changes not published yet (« Ma
 * page », the page and ticket designers) hold the refresh back: their work would be lost.
 */
export const PAGE_REFRESH_EVENT = 'dehors:page-refresh';

let holds = 0;

export const requestPageRefresh = () => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(PAGE_REFRESH_EVENT));
    }
};

export const isPageRefreshHeld = () => holds > 0;

export const useHoldPageRefresh = (hold: boolean) => {
    useEffect(() => {
        if (!hold) {
            return;
        }
        holds += 1;
        return () => {
            holds -= 1;
        };
    }, [hold]);
};
