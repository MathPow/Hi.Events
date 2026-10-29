import {AccountEventType} from "../../../types.ts";
import classes from "./EventTypeIllustration.module.scss";

const IMAGES: Record<Exclude<AccountEventType, 'SPORT'>, string> = {
    ENTREPRENEURSHIP: '/interface/bienvenue/entrepreneuriat.svg',
    SOCIAL: '/interface/bienvenue/social.svg',
    OTHER: '/interface/bienvenue/autre.svg',
};

// L'illustration d'un type d'evenement, carree, de --taille pixels (150 par defaut, celle de la
// bienvenue). Le sport, un dossard penche avec ses traits de vitesse, est monte en HTML comme
// dans la maquette, dessine a 150px puis reduit.
export const EventTypeIllustration = ({type}: { type: AccountEventType }) => {
    if (type !== 'SPORT') {
        return <img src={IMAGES[type]} alt={''} className={classes.illustration}/>;
    }

    return (
        <span className={classes.illustration} aria-hidden>
            <span className={classes.sport}>
                <span className={classes.bibFrame}>
                    <span className={classes.bib}>
                        <span className={classes.bibBand}/>
                        <span className={classes.bibNumber}>07</span>
                        <img src={'/interface/bienvenue/dossard-trou.svg'} alt={''} style={{left: 6, top: 4}}/>
                        <img src={'/interface/bienvenue/dossard-trou.svg'} alt={''} style={{left: 94, top: 4}}/>
                        <img src={'/interface/bienvenue/dossard-trou.svg'} alt={''} style={{left: 6, top: 70}}/>
                        <img src={'/interface/bienvenue/dossard-trou.svg'} alt={''} style={{left: 94, top: 70}}/>
                    </span>
                </span>
                <img src={'/interface/bienvenue/trait-1.svg'} alt={''} className={classes.speedLine} style={{left: -6, top: 64}}/>
                <img src={'/interface/bienvenue/trait-2.svg'} alt={''} className={classes.speedLine} style={{left: -14, top: 82}}/>
                <img src={'/interface/bienvenue/trait-3.svg'} alt={''} className={classes.speedLine} style={{left: -2, top: 100}}/>
            </span>
        </span>
    );
};
