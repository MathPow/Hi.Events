import {useEffect, useRef, useState} from "react";
import {t} from "@lingui/macro";
import {IconDownload} from "@tabler/icons-react";
import type {Map as MapLibreMap} from "maplibre-gl";
import {IdParam} from "../../../../types.ts";
import {EventRouteFilePublic, eventRouteFileClientPublic} from "../../../../api/eventRouteFile.client.ts";
import {useGetEventRouteFilesPublic} from "../../../../queries/useGetEventRouteFilesPublic.ts";
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
            ascent: elevationGain(points),
            loop: gpx.design ? gpx.design.kind === 'loop' : haversine(points[0], points[points.length - 1]) < 80,
        };
    } catch {
        return null;
    }
};

/**
 * « Parcours » on the event page: the course on a map (trails in orange), its distance and climb, its
 * elevation, and the GPX to load in a watch or an app. A tab per course when there are several.
 */
export const EventCourses = ({eventId}: { eventId: IdParam }) => {
    const {data: routeFiles} = useGetEventRouteFilesPublic(eventId);
    const frame = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLDivElement>(null);
    const [near, setNear] = useState(false);
    const [active, setActive] = useState(0);
    const [courses, setCourses] = useState<Record<number, LoadedCourse | null>>({});
    const [map, setMap] = useState<MapLibreMap | null>(null);

    const files = routeFiles ?? [];
    const current = files[Math.min(active, files.length - 1)];
    const course = current ? courses[current.id] : undefined;

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
        loadCourseMap(element, {cooperativeGestures: true})
            .then(({map: loaded, maplibregl}) => {
                if (cancelled) {
                    loaded.remove();
                    return;
                }
                created = loaded;
                loaded.addControl(new maplibregl.NavigationControl({showCompass: false}), 'top-right');
                setMap(loaded);
            })
            .catch(() => undefined);

        return () => {
            cancelled = true;
            created?.remove();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [near]);

    useEffect(() => {
        if (!map || !course) {
            return;
        }
        showCourse(map, course.points, COURSE_COLOR);
        const bounds = boundsOf(course.points);
        if (bounds) {
            map.fitBounds(bounds, {padding: 36, maxZoom: 16, duration: 0});
        }
    }, [map, course]);

    if (files.length === 0) {
        return null;
    }

    const label = current?.label ?? '';
    const climb = course ? formatClimb(course.ascent) : '';

    return (
        <section className={`${page.card} ${page.section} ${classes.courses}`} data-rough>
            <div className={classes.head}>
                <h2 className={page.sectionTitle}>{files.length > 1 ? t`Routes` : t`Route`}</h2>
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
