// The organizer last opened in the back office, so that links without one (/account/payment, the
// help center's) land on its settings.
const LAST_ORGANIZER_KEY = 'dehors-last-organizer';

export const rememberLastOrganizer = (organizerId: string | number) => {
    try {
        localStorage.setItem(LAST_ORGANIZER_KEY, String(organizerId));
    } catch {
        // localStorage unavailable
    }
};

export const lastOrganizerId = (): string | null => {
    try {
        return localStorage.getItem(LAST_ORGANIZER_KEY);
    } catch {
        return null;
    }
};
