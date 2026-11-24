import {useEffect, useRef, useState} from "react";
import {t} from "@lingui/macro";
import type {Map as MapLibreMap} from "maplibre-gl";
import {PublicIcon} from "../../../common/PublicIcon";
import {useGetEventMapLocation} from "../../../../queries/useGetEventMapLocation.ts";
import {toHexColor} from "../../../../utilites/themeUtils.ts";
import {IdParam} from "../../../../types.ts";
import {LatLng} from "../../../../utilites/course/geo.ts";
import {fetchMapStyle} from "./mapStyle.ts";
import classes from "./EventLocationMap.module.scss";

const DEHORS_ORANGE = '#fa7853';

// Un quartier: assez pres pour reconnaitre les rues, assez loin pour se situer.
const ZOOM = 14;

// Sans carte complete dans ce delai (OpenFreeMap lent ou injoignable), le dessin reste.
const LOAD_TIMEOUT_MS = 10000;

// La carte ne se charge qu'a l'approche de la section (MapLibre pese ~220 Ko).
const PRELOAD_MARGIN = '400px';

// Le parcours se voit en entier autour du repere, sans perdre la ville de vue.
const COURSE_MIN_ZOOM = 11;
const COURSE_SOURCE = 'parcours';

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
    // Le parcours de l'evenement, trace sous le repere.
    course?: LatLng[];
}

const courseData = (course: LatLng[]) => ({
    type: 'Feature' as const,
    properties: {},
    geometry: {type: 'LineString' as const, coordinates: course.map((point) => [point.lng, point.lat])},
});

// Le repere reste au centre: le zoom ou le parcours, replie autour du lieu, tient dans le cadre.
const fitAroundCenter = (map: MapLibreMap, course: LatLng[]) => {
    const center = map.getCenter();
    let west = center.lng, east = center.lng, south = center.lat, north = center.lat;
    course.forEach(({lat, lng}) => {
        const dLng = Math.abs(lng - center.lng);
        const dLat = Math.abs(lat - center.lat);
        west = Math.min(west, center.lng - dLng);
        east = Math.max(east, center.lng + dLng);
        south = Math.min(south, center.lat - dLat);
        north = Math.max(north, center.lat + dLat);
    });
    const camera = map.cameraForBounds([[west, south], [east, north]], {padding: 28});
    const zoom = Math.max(COURSE_MIN_ZOOM, Math.min(ZOOM, camera?.zoom ?? ZOOM));
    map.jumpTo({center, zoom});
};

/**
 * La carte « Emplacement »: le vrai quartier (OpenFreeMap, aux couleurs de l'organisateur) sous le
 * repere, et le lien vers l'itineraire. Tant qu'elle n'est pas prete, ou si le lieu ou les tuiles
 * sont introuvables, le plan dessine d'avant reste.
 */
export const EventLocationMap = ({eventId, mapUrl, accent, course}: EventLocationMapProps) => {
    const frame = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLDivElement>(null);
    const [near, setNear] = useState(false);
    const [shown, setShown] = useState(false);
    const [map, setMap] = useState<MapLibreMap | null>(null);
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
                    setMap(map ?? null);
                    setShown(true);
                });
            } catch {
                giveUp();
            }
        })();

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
            setMap(null);
            map?.remove();
        };
    }, [location, color]);

    // Le parcours, un trait epais a la couleur de l'organisateur, lisere creme, sous le repere.
    useEffect(() => {
        if (!map || !course || course.length < 2) {
            return;
        }
        const data = courseData(course);
        const source = map.getSource(COURSE_SOURCE) as { setData?: (data: unknown) => void } | undefined;
        if (source?.setData) {
            source.setData(data);
        } else {
            map.addSource(COURSE_SOURCE, {type: 'geojson', data});
            map.addLayer({
                id: `${COURSE_SOURCE}-contour`,
                type: 'line',
                source: COURSE_SOURCE,
                layout: {'line-cap': 'round', 'line-join': 'round'},
                paint: {'line-color': '#fffcf8', 'line-width': 9},
            });
            map.addLayer({
                id: COURSE_SOURCE,
                type: 'line',
                source: COURSE_SOURCE,
                layout: {'line-cap': 'round', 'line-join': 'round'},
                paint: {'line-color': color, 'line-width': 5},
            });
        }
        map.resize();
        fitAroundCenter(map, course);
    }, [map, course, color]);

    return (
        <div ref={frame} className={classes.frame}>
            <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={classes.map} data-rough
                data-course={course ? true : undefined}
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
