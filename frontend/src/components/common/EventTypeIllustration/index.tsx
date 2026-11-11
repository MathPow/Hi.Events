import {AccountEventType} from "../../../types.ts";
import classes from "./EventTypeIllustration.module.scss";

const IMAGES: Record<AccountEventType, string> = {
    SPORT: '/landing/stickers/autocollant-soulier.svg',
    ENTREPRENEURSHIP: '/landing/stickers/autocollant-entrepreneuriat.svg',
    SOCIAL: '/landing/stickers/autocollant-social.svg',
    OTHER: '/landing/stickers/autocollant-autre.svg',
};

// L'illustration d'un type d'evenement, l'autocollant de la marque, carree, de --taille pixels
// (150 par defaut, celle de la bienvenue).
export const EventTypeIllustration = ({type}: { type: AccountEventType }) => (
    <img src={IMAGES[type]} alt={''} className={classes.illustration}/>
);
