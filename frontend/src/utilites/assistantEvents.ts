// Opens the assistant panel (components/common/Assistant), from the help center.
export const OPEN_ASSISTANT_EVENT = 'dehors:open-assistant';

// A question asked before the panel is there (it loads after the page) waits here for it.
let waitingQuestion: string | null = null;

export const openAssistant = (question?: string) => {
    waitingQuestion = question?.trim() || null;
    window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT));
};

export const hasWaitingQuestion = () => waitingQuestion !== null;

export const takeWaitingQuestion = () => {
    const question = waitingQuestion;
    waitingQuestion = null;
    return question;
};
