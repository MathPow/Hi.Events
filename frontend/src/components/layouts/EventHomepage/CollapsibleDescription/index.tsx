import {useEffect, useRef, useState} from "react";
import {t} from "@lingui/macro";
import {PublicIcon} from "../../../common/PublicIcon";
import classes from "./CollapsibleDescription.module.scss";

// La description « A propos »: coupee avec un fondu, « Lire la suite » la deplie. Compacte (l'en-tete
// de la page d'un organisateur), elle s'arrete a quatre lignes et garde le style de sa page (className).
export const CollapsibleDescription = ({html, className, compact = false}: {
    html: string,
    className?: string,
    compact?: boolean,
}) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [expanded, setExpanded] = useState(false);
    const [overflowing, setOverflowing] = useState(false);

    useEffect(() => {
        const content = contentRef.current;
        if (!content || expanded) {
            return;
        }

        const measure = () => setOverflowing(content.scrollHeight > content.clientHeight + 1);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(content);

        return () => observer.disconnect();
    }, [html, expanded]);

    const classNames = [
        compact ? className : classes.description,
        compact ? '' : className,
        !expanded ? (compact ? classes.clampedCompact : classes.clamped) : '',
        !expanded && overflowing ? classes.faded : '',
    ].filter(Boolean).join(' ');

    return (
        <>
            <div ref={contentRef} className={classNames} dangerouslySetInnerHTML={{__html: html}}/>
            {overflowing && (
                <button
                    type="button"
                    className={classes.toggle}
                    aria-expanded={expanded}
                    onClick={() => setExpanded(value => !value)}
                >
                    {expanded ? t`Read less` : t`Read more`}
                    <PublicIcon name={'chevron'} size={16} className={expanded ? classes.chevronUp : undefined}/>
                </button>
            )}
        </>
    );
};
