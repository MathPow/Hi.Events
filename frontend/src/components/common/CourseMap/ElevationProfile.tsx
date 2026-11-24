import {useMemo} from "react";
import {t} from "@lingui/macro";
import {cumulative, TrackPoint} from "../../../utilites/course/geo.ts";
import {formatKm} from "./courseFormat.ts";
import classes from "./CourseMap.module.scss";

const WIDTH = 600;
const HEIGHT = 96;
const SAMPLES = 160;

/** The elevation along the course, as a filled line: where it climbs, at a glance. */
// The length shown under it: the route's own when known (the router's figure, as on the rest of the page).
// `color`: the organizer's, on their event page (orange otherwise).
export const ElevationProfile = ({points, distance, color}: { points: TrackPoint[], distance?: number, color?: string }) => {
    const profile = useMemo(() => {
        const withEle = points.filter((p) => p.ele !== undefined);
        if (withEle.length < 2 || withEle.length < points.length * 0.8) {
            return null;
        }

        const cum = cumulative(withEle);
        const total = cum[cum.length - 1];
        if (total <= 0) {
            return null;
        }

        const samples: { d: number; e: number }[] = [];
        let j = 0;
        for (let i = 0; i <= SAMPLES; i++) {
            const d = (total * i) / SAMPLES;
            while (j < cum.length - 2 && cum[j + 1] < d) {
                j++;
            }
            const span = cum[j + 1] - cum[j] || 1;
            const ratio = Math.max(0, Math.min(1, (d - cum[j]) / span));
            samples.push({d, e: withEle[j].ele! + ratio * (withEle[j + 1].ele! - withEle[j].ele!)});
        }

        const low = Math.min(...samples.map((s) => s.e));
        const high = Math.max(...samples.map((s) => s.e));
        // A flat course stays a low hill instead of filling the frame with 2 m of noise.
        const range = Math.max(high - low, 30);
        const x = (d: number) => (d / total) * WIDTH;
        const y = (e: number) => HEIGHT - 6 - ((e - low) / range) * (HEIGHT - 16);
        const line = samples.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(s.d).toFixed(1)},${y(s.e).toFixed(1)}`).join('');

        return {line, area: `${line}L${WIDTH},${HEIGHT}L0,${HEIGHT}Z`, low: Math.round(low), high: Math.round(high), total};
    }, [points]);

    if (!profile) {
        return null;
    }

    const low = profile.low;
    const high = profile.high;

    return (
        <figure className={classes.profile}>
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img"
                 aria-label={t`Elevation from ${low} m to ${high} m`}>
                <path d={profile.area} className={classes.profileArea}
                      style={color ? {fill: color, fillOpacity: 0.22} : undefined}/>
                <path d={profile.line} className={classes.profileLine} vectorEffect="non-scaling-stroke"
                      style={color ? {stroke: color} : undefined}/>
            </svg>
            <figcaption className={classes.profileCaption}>
                <span>{t`${low} m to ${high} m`}</span>
                <span>{formatKm(distance ?? profile.total)}</span>
            </figcaption>
        </figure>
    );
};
