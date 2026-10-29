import {t} from "@lingui/macro";
import {AccountEventType, Event} from "../types.ts";

// Les types d'evenements de la billetterie: l'etape « types d'evenements » de la bienvenue,
// et les sections du repertoire d'evenements.
export const EVENT_TYPES: AccountEventType[] = ['SPORT', 'ENTREPRENEURSHIP', 'SOCIAL', 'OTHER'];

export const eventTypeLabel = (type: AccountEventType) => ({
    SPORT: t`Sport`,
    ENTREPRENEURSHIP: t`Entrepreneurship`,
    SOCIAL: t`Social`,
    OTHER: t`Other`,
})[type];

// Un evenement porte une categorie de Hi.Events (EventCategories): chacune entre dans un type,
// et celles qui n'entrent dans aucun vont dans « Autre ».
const TYPE_OF_CATEGORY: Record<string, AccountEventType> = {
    SPORTS: 'SPORT',
    BUSINESS: 'ENTREPRENEURSHIP',
    TECH: 'ENTREPRENEURSHIP',
    SOCIAL: 'SOCIAL',
    FOOD_DRINK: 'SOCIAL',
    NIGHTLIFE: 'SOCIAL',
    FESTIVAL: 'SOCIAL',
    MUSIC: 'SOCIAL',
    COMEDY: 'SOCIAL',
    THEATER: 'SOCIAL',
};

export const eventTypeOf = (event: Event): AccountEventType => TYPE_OF_CATEGORY[event.category ?? ''] ?? 'OTHER';
