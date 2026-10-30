// Le dernier lien de « Mes billets » ouvert sur l'appareil (le jeton du courriel), garde dans un
// cookie aussi longtemps que le lien vaut (30 jours, SendTicketLookupEmailHandler): /my-tickets
// le rouvre, au rendu serveur comme dans le navigateur et l'app installee.
const COOKIE = 'dehors-mes-billets';
const MAX_AGE = 30 * 24 * 60 * 60;
const TOKEN = /^[A-Za-z0-9_-]+$/;

// « Changer » (de courriel) et « Retrouver un billet »: le formulaire du courriel, sans rouvrir
// le dernier lien.
export const OTHER_EMAIL_PARAM = 'autre-courriel';

export const savedTicketsLink = (cookies: string | null | undefined): string | null => {
    const match = cookies?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]*)`));
    const token = match ? decodeURIComponent(match[1]) : '';
    return TOKEN.test(token) ? token : null;
};

const writeCookie = (value: string, maxAge: number) => {
    const secure = window.location?.protocol === 'https:' ? ';Secure' : '';
    document.cookie = `${COOKIE}=${value};path=/;max-age=${maxAge};SameSite=Lax${secure}`;
};

export const saveTicketsLink = (token: string) => {
    if (typeof document !== 'undefined' && TOKEN.test(token)) {
        writeCookie(token, MAX_AGE);
    }
};

export const forgetTicketsLink = () => {
    if (typeof document !== 'undefined') {
        writeCookie('', 0);
    }
};
