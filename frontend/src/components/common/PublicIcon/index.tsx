import classes from "./PublicIcon.module.scss";

export type PublicIconName =
    'billet' | 'calendrier' | 'courriel' | 'fleche' | 'globe' | 'horloge'
    | 'instagram' | 'lieu' | 'lieu-petit' | 'partager'
    | 'retour' | 'chevron' | 'moins' | 'plus' | 'etiquette' | 'cadenas'
    | 'telecharger' | 'itineraire' | 'modifier' | 'chevron-droite' | 'imprimer' | 'etoile'
    | 'coche' | 'info' | 'qr' | 'soleil';

// Une icone de la maquette (public/interface/public), peinte de la couleur du texte par un masque:
// les pages publiques la teintent avec la couleur de l'organisateur.
export const PublicIcon = ({name, size = 16, className}: { name: PublicIconName, size?: number, className?: string }) => (
    <span
        aria-hidden
        className={className ? `${classes.icon} ${className}` : classes.icon}
        style={{
            width: size,
            height: size,
            maskImage: `url(/interface/public/${name}.svg)`,
            WebkitMaskImage: `url(/interface/public/${name}.svg)`,
        }}
    />
);
