import {HelpContent} from "./types.ts";
import {fr} from "./fr.ts";
import {en} from "./en.ts";

// eslint-disable-next-line lingui/no-unlocalized-strings
export const SUPPORT_EMAIL = 'support@dehorsqc.com';

// The app speaks French and English (locales.ts): English for anything else.
export const helpContent = (locale: string): HelpContent => (locale.startsWith('fr') ? fr : en);
