// « Changer » (de courriel) et « Retrouver un billet »: le formulaire du courriel, sans rouvrir
// la session de l'appareil.
export const OTHER_EMAIL_PARAM = 'autre-courriel';

// L'ancien cookie lisible par la page, qui gardait le lien lui-meme: on l'efface.
export const forgetLegacyTicketsLink = () => {
    if (typeof document !== 'undefined' && document.cookie.includes('dehors-mes-billets=')) {
        document.cookie = 'dehors-mes-billets=;path=/;max-age=0;SameSite=Lax';
    }
};
