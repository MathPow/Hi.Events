import {createContext, ReactNode, useContext, useEffect} from "react";
import {createPortal} from "react-dom";

interface TopBarActionSlot {
    target: HTMLElement | null;
    claim: () => () => void;
}

// A layout that offers its top bar to the pages (OrganizerLayout): a page's main button goes there,
// in place of the layout's own one (« Créer un événement »).
export const TopBarActionContext = createContext<TopBarActionSlot | null>(null);

export const useHasTopBarAction = () => useContext(TopBarActionContext) !== null;

export const TopBarAction = ({children}: { children: ReactNode }) => {
    const slot = useContext(TopBarActionContext);

    useEffect(() => slot?.claim(), [slot]);

    return slot?.target ? createPortal(children, slot.target) : null;
};
