import {useEffect, useRef, useState} from "react";
import type {Marker} from "maplibre-gl";
import {t} from "@lingui/macro";
import {IconDownload} from "@tabler/icons-react";
import type {Map as MapLibreMap} from "maplibre-gl";
import {IdParam} from "../../../../types.ts";
import {EventRouteFilePublic, eventRouteFileClientPublic} from "../../../../api/eventRouteFile.client.ts";
import {useGetEventRouteFilesPublic} from "../../../../queries/useGetEventRouteFilesPublic.ts";
import {useGetEventMapLocation} from "../../../../queries/useGetEventMapLocation.ts";
import {toHexColor} from "../../../../utilites/themeUtils.ts";
import {boundsOf, elevationGain, haversine, pathDistance, TrackPoint} from "../../../../utilites/course/geo.ts";
import {parseGpx} from "../../../../utilites/course/gpx.ts";
import {loadCourseMap, showCourse} from "../../../common/CourseMap/courseLayers.ts";
import {ElevationProfile} from "../../../common/CourseMap/ElevationProfile.tsx";
import {formatClimb, formatKm} from "../../../common/CourseMap/courseFormat.ts";
import shell from "../../OrganizerHomepage/OrganizerHomepage.module.scss";
import page from "../EventPage.module.scss";
import classes from "./EventCourses.module.scss";

interface LoadedCourse {
    points: TrackPoint[];
    distance: number;
    ascent: number;
    loop: boolean;
}

const COURSE_COLOR = '#352924';
const DEHORS_ORANGE = '#fa7853';
const VENUE_NEARBY_M = 2000;

// The map loads only when the section comes near (MapLibre weighs ~220 kB).
const PRELOAD_MARGIN = '400px';

const loadCourse = async (eventId: IdParam, routeFile: EventRouteFilePublic): Promise<LoadedCourse | null> => {
    try {
        const response = await fetch(eventRouteFileClientPublic.downloadUrl(eventId, routeFile.id));
        const gpx = response.ok ? parseGpx(await response.text()) : null;
        if (!gpx || gpx.points.length < 2) {
            return null;
        }
        const points = gpx.points;

        return {
            points,
            distance: pathDistance(points),
            ascent: gpx.design?.ascentM ?? elevationGain(points),
            loop: gpx.design ? gpx.design.kind === 'loop' : haversine(points[0], points[points.length - 1]) < 80,
        };
    } catch {
        return null;
    }
};

interface EventCoursesProps {
    eventId: IdParam;
    // The venue: the section becomes « Emplacement », its pin on the course map, its address below.
    address?: string | null;
    mapUrl?: string | null;
    accent?: string;
}

/**
 * « Emplacement » with a course: the course on a still map (trails in orange, the venue's pin), the
 * address, then its distance and climb, its elevation and the GPX to load in a watch or an app.
 * A tab per course when there are several.
 */
export const EventCourses = ({eventId, address, mapUrl, accent}: EventCoursesProps) => {
    const {data: routeFiles} = useGetEventRouteFilesPublic(eventId);
    const hasVenue = !!address;
    const frame = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLDivElement>(null);
    const [near, setNear] = useState(false);
    const [active, setActive] = useState(0);
    const [courses, setCourses] = useState<Record<number, LoadedCourse | null>>({});
    const [map, setMap] = useState<MapLibreMap | null>(null);
    const [makeMarker, setMakeMarker] = useState<(() => Marker) | null>(null);
    const {data: venue} = useGetEventMapLocation(eventId, near && hasVenue);

    const files = routeFiles ?? [];
    const current = files[Math.min(active, files.length - 1)];
    const course = current ? courses[current.id] : undefined;

    useEffect(() => {
        const element = frame.current;
        if (!element) {
            return;
        }
        if (typeof IntersectionObserver === 'undefined') {
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
    }, [files.length]);

    // Each course's GPX, read once.
    useEffect(() => {
        if (!near) {
            return;
        }
        let cancelled = false;
        files.forEach((routeFile) => {
            if (routeFile.id in courses) {
                return;
            }
            loadCourse(eventId, routeFile).then((loaded) => {
                if (!cancelled) {
                    setCourses((previous) => ({...previous, [routeFile.id]: loaded}));
                }
            });
        });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [near, files.map((routeFile) => routeFile.id).join(',')]);

    useEffect(() => {
        const element = canvas.current;
        if (!near || !element || map) {
            return;
        }
        let cancelled = false;
        let created: MapLibreMap | undefined;
        // Still: the page scrolls over it, nothing to drag.
        loadCourseMap(element, {interactive: false})
            .then(({map: loaded, maplibregl}) => {
                if (cancelled) {
                    loaded.remove();
                    return;
                }
                created = loaded;
                setMakeMarker(() => () => new maplibregl.Marker({color: toHexColor(accent) ?? DEHORS_ORANGE}));
                setMap(loaded);
            })
            .catch(() => undefined);

        return () => {
            cancelled = true;
            created?.remove();
        };
        // The section (and its map frame) only exists once the courses are known.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [near, files.length > 0]);

    useEffect(() => {
        if (!map || !course) {
            return;
        }
        showCourse(map, course.points, COURSE_COLOR);
    }, [map, course]);

    // The course fills the map, with the venue's pin when it stands by the course (a venue across
    // town would shrink the course to nothing).
    useEffect(() => {
        if (!map || !course) {
            return;
        }
        const pin = venue ? {lat: venue.latitude, lng: venue.longitude} : null;
        const pinNearby = !!pin && course.points.some((point) => haversine(point, pin) < VENUE_NEARBY_M);
        const bounds = boundsOf(pinNearby ? [...course.points, pin!] : course.points);
        if (bounds) {
            map.fitBounds(bounds, {padding: 36, maxZoom: 16, duration: 0});
        }
    }, [map, course, venue]);

    useEffect(() => {
        if (!map || !makeMarker || !venue) {
            return;
        }
        const marker = makeMarker().setLngLat([venue.longitude, venue.latitude]).addTo(map);

        return () => {
            marker.remove();
        };
    }, [map, makeMarker, venue]);

    if (files.length === 0) {
        return null;
    }

    const label = current?.label ?? '';
    const climb = course ? formatClimb(course.ascent) : '';

    return (
        <section className={`${page.card} ${page.section} ${classes.courses}`} data-rough>
            <div className={classes.head}>
                <h2 className={page.sectionTitle}>{hasVenue ? t`Location` : files.length > 1 ? t`Routes` : t`Route`}</h2>
                {files.length > 1 && (
                    <div className={classes.tabs} role="tablist" aria-label={t`Routes`}>
                        {files.map((routeFile, index) => (
                            <button key={routeFile.id} type="button" role="tab" className={classes.tab}
                                    aria-selected={index === active} onClick={() => setActive(index)}>
                                {routeFile.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div ref={frame} className={classes.mapFrame} data-rough>
                <div ref={canvas} className={classes.map}/>
            </div>

            {hasVenue && (
                mapUrl
                    ? <a href={mapUrl} target="_blank" rel="noopener noreferrer" className={classes.address}>{address}</a>
                    : <p className={classes.address}>{address}</p>
            )}

            <div className={classes.footer}>
                <div className={classes.figures}>
                    {course ? (
                        <>
                            <span className={classes.figure}>
                                <strong>{formatKm(course.distance)}</strong>
                                <span>{course.loop ? t`loop` : t`point to point`}</span>
                            </span>
                            <span className={classes.figure}>
                                <strong>{climb}</strong>
                                <span>{t`of climb`}</span>
                            </span>
                        </>
                    ) : (
                        <span className={classes.figure}><strong>{label}</strong></span>
                    )}
                </div>
                {current && (
                    <a href={eventRouteFileClientPublic.downloadUrl(eventId, current.id)}
                       className={`${shell.button} ${shell.buttonOutline} ${classes.download}`}
                       data-rough="button">
                        <IconDownload size={18} aria-hidden/>
                        {t`Download the GPX`}
                    </a>
                )}
            </div>

            {course && <ElevationProfile points={course.points}/>}
        </section>
    );
};
