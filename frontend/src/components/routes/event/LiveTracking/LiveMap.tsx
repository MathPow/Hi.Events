/* eslint-disable lingui/no-unlocalized-strings -- map source and layer ids */
import {useEffect, useRef, useState} from "react";
import type {GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent} from "maplibre-gl";
import {LiveTrackPoint} from "../../../../api/liveTrack.client.ts";
import {boundsOf, LatLng} from "../../../../utilites/course/geo.ts";
import {LoadedLiveCourse} from "../../../../utilites/course/liveProgress.ts";
import {loadCourseMap, showCourse} from "../../../common/CourseMap/courseLayers.ts";
import {COURSE_INK} from "../../../common/CourseMap/courseMapStyle.ts";
import {Runner, STATE_COLORS} from "./liveStatus.ts";
import classes from "./LiveTracking.module.scss";

const RUNNERS = 'dehors-live-runners';
const TRAIL = 'dehors-live-trail';
const FONT = ['Noto Sans Bold'];

const empty = (): GeoJSON.FeatureCollection => ({type: 'FeatureCollection', features: []});

const addLiveLayers = (map: MapLibreMap) => {
    map.addSource(TRAIL, {type: 'geojson', data: empty()});
    map.addSource(RUNNERS, {type: 'geojson', data: empty()});

    map.addLayer({
        id: `${TRAIL}-line`,
        type: 'line',
        source: TRAIL,
        layout: {'line-cap': 'round', 'line-join': 'round'},
        paint: {'line-color': '#2f7d6d', 'line-width': 3.5, 'line-dasharray': [1.5, 1.2]},
    });
    map.addLayer({
        id: `${RUNNERS}-halo`,
        type: 'circle',
        source: RUNNERS,
        filter: ['==', ['get', 'selected'], true],
        paint: {'circle-radius': 21, 'circle-color': ['get', 'color'], 'circle-opacity': 0.25},
    });
    map.addLayer({
        id: `${RUNNERS}-dot`,
        type: 'circle',
        source: RUNNERS,
        paint: {
            'circle-radius': 13,
            'circle-color': ['get', 'color'],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2.5,
        },
    });
    map.addLayer({
        id: `${RUNNERS}-label`,
        type: 'symbol',
        source: RUNNERS,
        layout: {
            'text-field': ['get', 'short'],
            'text-font': FONT,
            'text-size': 10.5,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
        },
        paint: {'text-color': '#ffffff'},
    });
};

interface LiveMapProps {
    course: LoadedLiveCourse | null;
    runners: Runner[];
    selectedId: number | null;
    trail: LiveTrackPoint[] | undefined;
    onSelect: (id: number | null) => void;
}

/**
 * The course and a dot per participant on it, in the color of their state; the selected
 * participant's trail behind them.
 */
export const LiveMap = ({course, runners, selectedId, trail, onSelect}: LiveMapProps) => {
    const container = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<MapLibreMap | null>(null);
    const fitted = useRef<string | null>(null);
    const select = useRef(onSelect);
    select.current = onSelect;

    useEffect(() => {
        const element = container.current;
        if (!element) {
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
                addLiveLayers(loaded);
                loaded.on('click', `${RUNNERS}-dot`, (event: MapLayerMouseEvent) => {
                    const id = event.features?.[0]?.properties?.id;
                    select.current(typeof id === 'number' ? id : Number(id));
                });
                loaded.on('mouseenter', `${RUNNERS}-dot`, () => {
                    loaded.getCanvas().style.cursor = 'pointer';
                });
                loaded.on('mouseleave', `${RUNNERS}-dot`, () => {
                    loaded.getCanvas().style.cursor = '';
                });
                setMap(loaded);
            })
            .catch(() => undefined);

        return () => {
            cancelled = true;
            created?.remove();
        };
    }, []);

    useEffect(() => {
        if (map) {
            showCourse(map, course?.points ?? [], COURSE_INK);
        }
    }, [map, course]);

    useEffect(() => {
        if (!map) {
            return;
        }
        const features: GeoJSON.Feature[] = runners
            .filter((runner) => runner.track.latitude != null && runner.track.longitude != null)
            // The selected one drawn last, over the others.
            .sort((a, b) => Number(a.track.id === selectedId) - Number(b.track.id === selectedId))
            .map((runner) => ({
                type: 'Feature',
                properties: {
                    id: runner.track.id,
                    short: runner.short,
                    color: STATE_COLORS[runner.state],
                    selected: runner.track.id === selectedId,
                },
                geometry: {type: 'Point', coordinates: [runner.track.longitude!, runner.track.latitude!]},
            }));
        (map.getSource(RUNNERS) as GeoJSONSource | undefined)?.setData({type: 'FeatureCollection', features});
    }, [map, runners, selectedId]);

    useEffect(() => {
        if (!map) {
            return;
        }
        const coordinates = (trail ?? []).map((point) => [point.longitude, point.latitude]);
        (map.getSource(TRAIL) as GeoJSONSource | undefined)?.setData(coordinates.length > 1
            ? {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates}}]}
            : empty());
    }, [map, trail]);

    // Framed once on the course (or on the participants without one), then left to the organizer.
    useEffect(() => {
        if (!map) {
            return;
        }
        const positions: LatLng[] = runners
            .filter((runner) => runner.track.latitude != null && runner.track.longitude != null)
            .map((runner) => ({lat: runner.track.latitude!, lng: runner.track.longitude!}));
        const key = course ? `course-${course.id}` : positions.length > 0 ? 'runners' : null;
        if (!key || fitted.current === key) {
            return;
        }
        const bounds = boundsOf(course ? course.points : positions);
        if (bounds) {
            map.fitBounds(bounds, {padding: 48, maxZoom: 16, duration: 0});
            fitted.current = key;
        }
    }, [map, course, runners]);

    // On the selected participant, without zooming out.
    useEffect(() => {
        const runner = runners.find((candidate) => candidate.track.id === selectedId);
        if (!map || !runner || runner.track.latitude == null || runner.track.longitude == null) {
            return;
        }
        map.easeTo({center: [runner.track.longitude, runner.track.latitude], zoom: Math.max(map.getZoom(), 14), duration: 600});
        // Only when the selection changes, not on every refresh of its position.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, selectedId]);

    return <div ref={container} className={classes.map}/>;
};
