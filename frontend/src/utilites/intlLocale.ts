import {i18n} from "@lingui/core";

// La langue de la page pour Intl (la meme au rendu serveur et dans le navigateur, contrairement a
// navigator.language), a la canadienne pour le francais et l'anglais: « 18 h 30 », « 15,00 $ ».
export const intlLocale = () => {
    const locale = i18n.locale || 'en';
    if (locale === 'fr' || locale === 'en') {
        return `${locale}-CA`;
    }
    return locale === 'se' ? 'sv' : locale;
};
