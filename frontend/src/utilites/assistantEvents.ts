// The help center link in the nav opens the assistant panel (components/common/Assistant).
export const OPEN_ASSISTANT_EVENT = 'dehors:open-assistant';

export const openAssistant = () => {
    window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT));
};
