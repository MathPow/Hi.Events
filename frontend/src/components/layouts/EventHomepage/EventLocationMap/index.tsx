import {useEffect, useRef, useState} from "react";
import {t} from "@lingui/macro";
import type {Map as MapLibreMap} from "maplibre-gl";
import {PublicIcon} from "../../../common/PublicIcon";
import {useGetEventMapLocation} from "../../../../queries/useGetEventMapLocation.ts";
import {toHexColor} from "../../../../utilites/themeUtils.ts";
import {IdParam} from "../../../../types.ts";
import {fetchMapStyle} from "./mapStyle.ts";
import classes from "./EventLocationMap.module.scss";

const DEHORS_ORANGE = '#fa7853';

// Un quartier: assez pres pour reconnaitre les rues, assez loin pour se situer.
const ZOOM = 14;

// Sans carte complete dans ce delai (OpenFreeMap lent ou injoignable), le dessin reste.
const LOAD_TIMEOUT_MS = 10000;

// La carte ne se charge qu'a l'approche de la section (MapLibre pese ~220 Ko).
const PRELOAD_MARGIN = '400px';

// Le credit demande par OpenFreeMap et OpenStreetMap (licence ODbL des donnees).
/* eslint-disable lingui/no-unlocalized-strings */
const CREDITS = [
    {label: 'OpenFreeMap', href: 'https://openfreemap.org'},
    {label: '© OpenMapTiles', href: 'https://www.openmaptiles.org/'},
    {label: '© OpenStreetMap', href: 'https://www.openstreetmap.org/copyright'},
];
/* eslint-enable lingui/no-unlocalized-strings */

interface EventLocationMapProps {
    eventId: IdParam;
    mapUrl: string;
    accent?: string;
}

/**
 * La carte « Emplacement »: le vrai quartier (OpenFreeMap, aux couleurs de l'organisateur) sous le
 * repere, et le lien vers l'itineraire. Tant qu'elle n'est pas prete, ou si le lieu ou les tuiles
 * sont introuvables, le plan dessine d'avant reste.
 */
export const EventLocationMap = ({eventId, mapUrl, accent}: EventLocationMapProps) => {
    const frame = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLDivElement>(null);
    const [near, setNear] = useState(false);
    const [shown, setShown] = useState(false);
    const {data: location} = useGetEventMapLocation(eventId, near && eventId !== undefined);
    const color = toHexColor(accent) ?? DEHORS_ORANGE;

    useEffect(() => {
        const element = frame.current;
        if (!element || typeof IntersectionObserver === 'undefined') {
            setNear(true);
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                setNear(true);
                observer.disconnect();
            }
        }, {rootMargin: PRELOAD_MARGIN});
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const container = canvas.current;
        if (!location || !container) {
            return;
        }

        let map: MapLibreMap | undefined;
        let cancelled = false;
        let loaded = false;
        const giveUp = () => {
            cancelled = true;
            map?.remove();
            map = undefined;
            setShown(false);
        };
        const timeout = window.setTimeout(giveUp, LOAD_TIMEOUT_MS);

        (async () => {
            try {
                const [{default: maplibregl}, style] = await Promise.all([
                    import('maplibre-gl'),
                    fetchMapStyle(color),
                    import('maplibre-gl/dist/maplibre-gl.css'),
                ]);
                if (cancelled) {
                    return;
                }

                map = new maplibregl.Map({
                    container,
                    style,
                    center: [location.longitude, location.latitude],
                    zoom: ZOOM,
                    interactive: false,
                    attributionControl: false,
                });
                map.on('error', () => !loaded && giveUp());
                map.once('load', () => {
                    loaded = true;
                    window.clearTimeout(timeout);
                    setShown(true);
                });
            } catch {
                giveUp();
            }
        })();

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
            map?.remove();
        };
    }, [location, color]);

    return (
        <div ref={frame} className={classes.frame}>
            <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={classes.map} data-rough
                data-shown={shown || undefined}
                aria-label={t`View on Google Maps`}
            >
                {/* Le plan dessine: avant la carte, ou a sa place si elle ne vient pas. */}
                <svg className={classes.roads} viewBox="0 0 696 240" preserveAspectRatio="none" aria-hidden>
                    <path d="M0 80L760 140M0 200L760 170M200 0L260 240M520 0L470 240" vectorEffect="non-scaling-stroke"/>
                </svg>
                <div ref={canvas} className={classes.canvas} aria-hidden/>
                <span className={classes.pin}>
                    <PublicIcon name={'lieu'} size={24}/>
                </span>
            </a>
            {shown && (
                <p className={classes.credit}>
                    {CREDITS.map(({label, href}) => (
                        <a key={href} href={href} target="_blank" rel="noopener noreferrer">{label}</a>
                    ))}
                </p>
            )}
        </div>
    );
};
