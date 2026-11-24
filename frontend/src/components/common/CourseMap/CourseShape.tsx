import {useMemo} from "react";
import {LatLng} from "../../../utilites/course/geo.ts";

interface CourseShapeProps {
    points: LatLng[];
    color: string;
    size?: number;
    className?: string;
}

const PADDING = 5;
const MAX_POINTS = 160;

/** A course's outline, small: a thumbnail beside its name, its start a dot. */
export const CourseShape = ({points, color, size = 44, className}: CourseShapeProps) => {
    const shape = useMemo(() => {
        if (points.length < 2) {
            return null;
        }
        const step = Math.max(1, Math.floor(points.length / MAX_POINTS));
        const sampled = points.filter((_, index) => index % step === 0 || index === points.length - 1);
        const kx = Math.cos((sampled[0].lat * Math.PI) / 180);
        const xs = sampled.map((p) => p.lng * kx);
        const ys = sampled.map((p) => -p.lat);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const width = Math.max(...xs) - minX;
        const height = Math.max(...ys) - minY;
        const scale = (size - 2 * PADDING) / Math.max(width, height, 1e-9);
        const offsetX = (size - width * scale) / 2;
        const offsetY = (size - height * scale) / 2;
        const at = (i: number) => [offsetX + (xs[i] - minX) * scale, offsetY + (ys[i] - minY) * scale];

        const path = sampled.map((_, i) => {
            const [x, y] = at(i);
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        }).join('');
        const [startX, startY] = at(0);

        return {path, startX, startY};
    }, [points, size]);

    return (
        <svg className={className} viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
            {shape && (
                <>
                    <path d={shape.path} fill="none" stroke={color} strokeWidth={2.25} strokeLinecap="round"
                          strokeLinejoin="round"/>
                    <circle cx={shape.startX} cy={shape.startY} r={3} fill="#352924" stroke="#ffffff" strokeWidth={1.25}/>
                </>
            )}
        </svg>
    );
};
