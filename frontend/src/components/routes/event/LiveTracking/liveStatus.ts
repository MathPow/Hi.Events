import {t} from "@lingui/macro";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import {LiveTrack} from "../../../../api/liveTrack.client.ts";
import {CoursePosition, LoadedLiveCourse, locateOnCourse, pickCourse} from "../../../../utilites/course/liveProgress.ts";
import {intlLocale} from "../../../../utilites/intlLocale.ts";

dayjs.extend(utc);

// What the organizer needs to know at a glance, from the last position and its age.
export type RunnerState = 'alert' | 'running' | 'waiting' | 'finished' | 'failed';

export type RunnerAlert = 'lost' | 'stopped' | 'offcourse';

// No new position for this long: the watch or the phone has lost its connection, or worse.
export const LOST_AFTER_MINUTES = 10;
// Standing still this long, away from the finish.
export const STOPPED_AFTER_MINUTES = 10;
// Further than this from the course.
export const OFF_COURSE_METRES = 150;
// Past this share of the course, standing still is being at the finish.
const AT_FINISH_SHARE = 0.97;

export const STATE_COLORS: Record<RunnerState, string> = {
    alert: '#d6452f',
    running: '#2f7d6d',
    waiting: '#9b918a',
    finished: '#352924',
    failed: '#9b918a',
};

export interface Runner {
    track: LiveTrack;
    name: string;
    short: string;
    state: RunnerState;
    alerts: RunnerAlert[];
    course: LoadedLiveCourse | null;
    position: CoursePosition | null;
    minutesSincePoint: number | null;
    minutesStill: number | null;
}

const minutesSince = (date: string | null, now: number): number | null =>
    date ? Math.max(0, (now - dayjs.utc(date).valueOf()) / 60000) : null;

export const toRunner = (track: LiveTrack, courses: LoadedLiveCourse[], now: number): Runner => {
    const first = track.attendee?.first_name?.trim() ?? '';
    const last = track.attendee?.last_name?.trim() ?? '';
    const name = `${first} ${last}`.trim() || t`Participant`;
    const bib = track.attendee?.bib_number;
    const short = bib ? String(bib) : `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?';

    const point = track.latitude != null && track.longitude != null ? {lat: track.latitude, lng: track.longitude} : null;
    const course = pickCourse(courses, track.attendee?.product_title, point);
    const position = point && course ? locateOnCourse(point, course, track.distance_m) : null;
    const minutesSincePoint = minutesSince(track.last_point_at, now);
    const minutesStill = minutesSince(track.still_since, now);

    const alerts: RunnerAlert[] = [];
    let state: RunnerState;
    if (track.status === 'FAILED') {
        state = 'failed';
    } else if (track.status === 'WAITING' || !point) {
        state = 'waiting';
    } else if (track.status === 'ENDED') {
        state = 'finished';
    } else {
        const atFinish = !!position && position.share >= AT_FINISH_SHARE;
        if (minutesSincePoint !== null && minutesSincePoint >= LOST_AFTER_MINUTES) {
            alerts.push('lost');
        }
        if (minutesStill !== null && minutesStill >= STOPPED_AFTER_MINUTES && !atFinish) {
            alerts.push('stopped');
        }
        if (position && position.off > OFF_COURSE_METRES) {
            alerts.push('offcourse');
        }
        state = alerts.length > 0 ? 'alert' : 'running';
    }

    return {track, name, short, state, alerts, course, position, minutesSincePoint, minutesStill};
};

const ORDER: Record<RunnerState, number> = {alert: 0, running: 1, waiting: 2, finished: 3, failed: 4};

// Alerts first, then the furthest along.
export const sortRunners = (runners: Runner[]): Runner[] => [...runners].sort((a, b) =>
    ORDER[a.state] - ORDER[b.state]
    || (b.position?.along ?? b.track.distance_m ?? 0) - (a.position?.along ?? a.track.distance_m ?? 0)
    || a.name.localeCompare(b.name));

export const formatMinutes = (minutes: number): string => {
    if (minutes < 1) {
        return t`just now`;
    }
    const rounded = Math.round(minutes);
    if (rounded < 60) {
        return t`${rounded} min ago`;
    }
    const hours = Math.floor(rounded / 60);
    const rest = String(rounded % 60).padStart(2, '0');

    return t`${hours} h ${rest} ago`;
};

export const alertLabel = (runner: Runner, alert: RunnerAlert): string => {
    switch (alert) {
        case 'lost': {
            const minutes = Math.round(runner.minutesSincePoint ?? 0);
            return t`No signal for ${minutes} min`;
        }
        case 'stopped': {
            const minutes = Math.round(runner.minutesStill ?? 0);
            return t`Not moving for ${minutes} min`;
        }
        case 'offcourse': {
            const metres = Math.round(runner.position?.off ?? 0);
            return t`${metres} m off the course`;
        }
    }
};

export const stateLabel = (runner: Runner): string => {
    switch (runner.state) {
        case 'alert':
            return alertLabel(runner, runner.alerts[0]);
        case 'running':
            return t`On the course`;
        case 'waiting':
            return t`Waiting for the start`;
        case 'finished':
            return t`Activity ended`;
        case 'failed':
            return t`Link no longer works`;
    }
};

/** « 5:12 /km » from metres per second. */
export const formatPace = (speedMps: number | null | undefined): string | null => {
    if (!speedMps || speedMps < 0.3) {
        return null;
    }
    const secondsPerKm = Math.round(1000 / speedMps);
    if (secondsPerKm >= 3600) {
        return null;
    }

    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = String(secondsPerKm % 60).padStart(2, '0');

    return t`${minutes}:${seconds} /km`;
};

/** « 12,4 km/h ». */
export const formatSpeed = (speedMps: number | null | undefined): string | null => {
    if (speedMps == null) {
        return null;
    }

    return new Intl.NumberFormat(intlLocale(), {style: 'unit', unit: 'kilometer-per-hour', maximumFractionDigits: 1}).format(speedMps * 3.6);
};

/** « 1:05:12 ». */
export const formatDuration = (seconds: number | null | undefined): string | null => {
    if (seconds == null) {
        return null;
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};
