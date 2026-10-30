// The landing's four tints (the organizers' pills, the next events' cards), and those that take
// cream text.
const ORANGE = '#fa7853';
export const TINTS = ['#352924', '#e3ad92', '#ffaa8d', ORANGE];
export const DARK_TINTS = new Set(['#352924', ORANGE]);

// Seeded, for the server and the browser to draw the same.
export const seededRandom = (seed: number) => () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
};
