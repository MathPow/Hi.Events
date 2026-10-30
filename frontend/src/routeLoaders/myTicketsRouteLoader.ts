import {LoaderFunctionArgs, redirect} from "react-router";
import {OTHER_EMAIL_PARAM, savedTicketsLink} from "../utilites/myTicketsLink.ts";

// /my-tickets sans lien rouvre le dernier lien de l'appareil, avant le premier rendu: pas de
// formulaire du courriel entrevu. Le serveur lit le cookie de la requete, le navigateur le sien.
export const myTicketsRouteLoader = ({params, request}: LoaderFunctionArgs) => {
    if (params.token || new URL(request.url).searchParams.has(OTHER_EMAIL_PARAM)) {
        return null;
    }

    const saved = savedTicketsLink(typeof document === 'undefined'
        ? request.headers.get('cookie')
        : document.cookie);

    if (saved) {
        throw redirect(`/my-tickets/${saved}`);
    }

    return null;
};
