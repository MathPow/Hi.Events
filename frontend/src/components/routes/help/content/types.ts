// The help center's guides and questions, written per language (content/fr.ts, content/en.ts):
// long texts, kept out of the translation catalogs. Texts take **bold** and [links](/path).

export type HelpBlock =
    | { h2: string }
    | { p: string }
    | { ul: string[] }
    | { ol: string[] }
    // A highlighted line: a tip, or a warning.
    | { tip: string };

export interface HelpGuide {
    // Its address: /help/<slug>, the same in every language.
    slug: string;
    category: string;
    title: string;
    lead: string;
    // When it was last checked against the app, YYYY-MM-DD.
    updated: string;
    minutes: number;
    blocks: HelpBlock[];
}

export interface HelpQuestion {
    // Its tab in the frequent questions (All, then one per subject, in the order they first come).
    category: string;
    question: string;
    // Paragraphs separated by a blank line.
    answer: string;
}

export interface HelpContent {
    guides: HelpGuide[];
    questions: HelpQuestion[];
}
