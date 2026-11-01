import {useEffect, useState} from "react";

// The organizer assistant (components/common/Assistant) and the phone's tab bar (AppLayout/MobileNav),
// whose « Assistant » tab opens and closes it.

const TOGGLE_EVENT = 'dehors:assistant-toggle';
const STATE_EVENT = 'dehors:assistant-state';

export interface AssistantState {
    // The panel is there (signed in, back-office page).
    available: boolean;
    open: boolean;
    busy: boolean;
}

let current: AssistantState = {available: false, open: false, busy: false};

export const toggleAssistant = () => window.dispatchEvent(new Event(TOGGLE_EVENT));

export const onAssistantToggle = (listener: () => void) => {
    window.addEventListener(TOGGLE_EVENT, listener);
    return () => window.removeEventListener(TOGGLE_EVENT, listener);
};

export const publishAssistantState = (state: AssistantState) => {
    current = state;
    window.dispatchEvent(new Event(STATE_EVENT));
};

export const useAssistantState = (): AssistantState => {
    const [state, setState] = useState(current);
    useEffect(() => {
        const update = () => setState(current);
        update();
        window.addEventListener(STATE_EVENT, update);
        return () => window.removeEventListener(STATE_EVENT, update);
    }, []);
    return state;
};
