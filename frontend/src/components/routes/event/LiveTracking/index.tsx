import {useEffect, useMemo, useState} from "react";
import {useParams} from "react-router";
import {t} from "@lingui/macro";
import {Skeleton} from "@mantine/core";
import {useQueries} from "@tanstack/react-query";
import {IconBroadcast, IconExternalLink, IconX} from "@tabler/icons-react";
import classNames from "classnames";
import {useGetEventSettings} from "../../../../queries/useGetEventSettings.ts";
import {useUpdateEventSettings} from "../../../../mutations/useUpdateEventSettings.ts";
import {useGetEventRouteFiles} from "../../../../queries/useGetEventRouteFiles.ts";
import {eventRouteFileGpxQuery} from "../../../../queries/useGetEventRouteFileGpx.ts";
import {useGetEventLiveTracks} from "../../../../queries/useGetEventLiveTracks.ts";
import {useGetLiveTrackPoints} from "../../../../queries/useGetLiveTrackPoints.ts";
import {LIVE_TRACK_GUIDE_PATH} from "../../../../api/liveTrack.client.ts";
import {LoadedLiveCourse, loadLiveCourse} from "../../../../utilites/course/liveProgress.ts";
import {showError, showSuccess} from "../../../../utilites/notifications.tsx";
import {formatClimb, formatKm} from "../../../common/CourseMap/courseFormat.ts";
import {CopyButton} from "../../../common/CopyButton";
import {Pill} from "../../../common/Pill";
import {SettingsCard, ToggleRow} from "../../organizer/Settings/SettingsUi.tsx";
import {LiveMap} from "./LiveMap.tsx";
import {
    alertLabel,
    formatDuration,
    formatMinutes,
    formatPace,
    formatSpeed,
    Runner,
    sortRunners,
    STATE_COLORS,
    stateLabel,
    toRunner,
} from "./liveStatus.ts";
import classes from "./LiveTracking.module.scss";

// The « il y a 3 min » move on between two refreshes.
const CLOCK_MS = 15000;

const useNow = () => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), CLOCK_MS);
        return () => window.clearInterval(timer);
    }, []);

    return now;
};

const Figure = ({label, value}: { label: string, value: string | null }) => value ? (
    <div className={classes.figure}>
        <dt>{label}</dt>
        <dd>{value}</dd>
    </div>
) : null;

const RunnerDetails = ({runner, onClose}: { runner: Runner, onClose: () => void }) => {
    const {track, position} = runner;
    const along = position ? formatKm(position.along) : null;
    const total = runner.course ? formatKm(runner.course.total) : null;
    const percent = position ? Math.round(position.share * 100) : null;
    const lastSeen = runner.minutesSincePoint != null ? formatMinutes(runner.minutesSincePoint) : null;
    const averageSpeed = track.distance_m && track.duration_s ? track.distance_m / track.duration_s : null;
    const bib = track.attendee?.bib_number;
    const heartRate = track.heart_rate;
    const cadence = track.cadence;
    const coordinates = track.latitude != null && track.longitude != null
        ? `${track.latitude.toFixed(5)}, ${track.longitude.toFixed(5)}`
        : null;

    return (
        <section className={classes.details} aria-label={runner.name}>
            <div className={classes.detailsHead}>
                <span className={classes.dot} style={{background: STATE_COLORS[runner.state]}} aria-hidden/>
                <div className={classes.detailsName}>
                    <h3>{runner.name}</h3>
                    <p>
                        {[bib ? t`Bib ${bib}` : null, track.attendee?.product_title]
                            .filter(Boolean).join(' · ')}
                    </p>
                </div>
                <button type="button" className={classes.close} onClick={onClose} aria-label={t`Close`}>
                    <IconX size={18}/>
                </button>
            </div>

            <p className={classNames(classes.stateLine, {[classes.stateAlert]: runner.state === 'alert'})}>
                {runner.alerts.length > 0
                    ? runner.alerts.map((alert) => alertLabel(runner, alert)).join(' · ')
                    : stateLabel(runner)}
            </p>

            {track.status === 'FAILED' && track.last_error && <p className={classes.muted}>{track.last_error}</p>}

            {position && percent !== null && (
                <div className={classes.progress}>
                    <div className={classes.progressBar}>
                        <span style={{width: `${percent}%`}}/>
                    </div>
                    <span>{t`${along} of ${total} · ${percent} %`}</span>
                </div>
            )}

            <dl className={classes.figures}>
                <Figure label={t`Last position`} value={lastSeen}/>
                <Figure label={t`Watch distance`} value={track.distance_m != null ? formatKm(track.distance_m) : null}/>
                <Figure label={t`Elapsed time`} value={formatDuration(track.duration_s)}/>
                <Figure label={t`Current pace`} value={formatPace(track.speed_mps)}/>
                <Figure label={t`Current speed`} value={formatSpeed(track.speed_mps)}/>
                <Figure label={t`Average pace`} value={formatPace(averageSpeed)}/>
                <Figure label={t`Heart rate`} value={heartRate ? t`${heartRate} bpm` : null}/>
                <Figure label={t`Cadence`} value={cadence ? t`${cadence} spm` : null}/>
                <Figure label={t`Climb`} value={track.elevation_gain_m != null ? formatClimb(track.elevation_gain_m) : null}/>
                <Figure label={t`Altitude`} value={track.altitude_m != null ? formatClimb(track.altitude_m) : null}/>
                <Figure label={t`Off the course`} value={position ? formatKm(position.off) : null}/>
            </dl>

            {coordinates && (
                <div className={classes.coordinates}>
                    <span>{t`Coordinates`}</span>
                    <code>{coordinates}</code>
                    <CopyButton value={coordinates}/>
                </div>
            )}

            <a href={track.share_url} target="_blank" rel="noreferrer" className={classes.externalLink}>
                <IconExternalLink size={16}/>
                {t`Open in Garmin LiveTrack`}
            </a>
        </section>
    );
};

/**
 * « Suivi en direct »: the participants who share their Garmin LiveTrack, on the course, with
 * an alert for anyone without signal, standing still or off the course.
 */
const LiveTracking = () => {
    const {eventId} = useParams();
    const now = useNow();
    const settingsQuery = useGetEventSettings(eventId);
    const updateSettings = useUpdateEventSettings();
    const enabled = !!settingsQuery.data?.live_tracking_enabled;
    const routeFiles = useGetEventRouteFiles(eventId).data ?? [];
    const tracksQuery = useGetEventLiveTracks(enabled ? eventId : undefined);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [courseIndex, setCourseIndex] = useState(0);
    const trailQuery = useGetLiveTrackPoints(eventId, selectedId);

    const gpxQueries = useQueries({queries: routeFiles.map((routeFile) => eventRouteFileGpxQuery(eventId!, routeFile))});
    const courses: LoadedLiveCourse[] = useMemo(() => routeFiles.flatMap((routeFile, index) => {
        const points = gpxQueries[index]?.data?.points;
        return points && points.length > 1 ? [loadLiveCourse(routeFile.id, routeFile.label, points)] : [];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [routeFiles.map((routeFile) => routeFile.id).join(','), gpxQueries.map((query) => query.dataUpdatedAt).join(',')]);

    const runners = useMemo(
        () => sortRunners((tracksQuery.data ?? []).map((track) => toRunner(track, courses, now))),
        [tracksQuery.data, courses, now],
    );
    const selected = runners.find((runner) => runner.track.id === selectedId) ?? null;

    // The map shows the selected participant's course; else the one picked in the tabs.
    const shownCourse = selected?.course ?? courses[Math.min(courseIndex, courses.length - 1)] ?? null;

    const counts = {
        running: runners.filter((runner) => runner.state === 'running').length,
        alert: runners.filter((runner) => runner.state === 'alert').length,
        waiting: runners.filter((runner) => runner.state === 'waiting').length,
        finished: runners.filter((runner) => runner.state === 'finished').length,
    };

    const guideUrl = typeof window !== 'undefined' ? `${window.location.origin}${LIVE_TRACK_GUIDE_PATH}` : LIVE_TRACK_GUIDE_PATH;

    const toggle = (checked: boolean) => updateSettings.mutate(
        {eventId: eventId!, eventSettings: {live_tracking_enabled: checked}},
        {
            onSuccess: () => showSuccess(checked
                ? t`Live tracking is on. Participants see it on their ticket.`
                : t`Live tracking is off.`),
            onError: () => showError(t`Something went wrong. Please try again.`),
        },
    );

    return (
        <div className={classes.page}>
            <header className={classes.header}>
                <h1 className={classes.title}>{t`Live tracking`}</h1>
                <p className={classes.subtitle}>
                    {t`Participants share their Garmin LiveTrack from their ticket. See where everyone is on the course, with their watch's figures, and who has stopped, lost the signal or left the course.`}
                </p>
            </header>

            {settingsQuery.isLoading ? (
                <Skeleton height={120} radius={24}/>
            ) : (
                <SettingsCard
                    full
                    title={t`Offer live tracking`}
                    subtitle={t`Garmin watches only, with the Garmin Connect app on a phone that has data. Positions are read every minute and deleted after 14 days.`}
                >
                    <ToggleRow
                        label={t`Participants can share their Garmin LiveTrack`}
                        hint={t`A « Live tracking » card appears on each ticket, with the steps and a field to paste the link.`}
                        checked={enabled}
                        disabled={updateSettings.isPending}
                        onChange={toggle}
                    />
                    {enabled && (
                        <div className={classes.guide}>
                            <span>{t`Steps for your participants:`}</span>
                            <a href={LIVE_TRACK_GUIDE_PATH} target="_blank" rel="noreferrer">{guideUrl}</a>
                            <CopyButton value={guideUrl}/>
                        </div>
                    )}
                    {enabled && routeFiles.length === 0 && (
                        <p className={classes.muted}>
                            {t`Add a route in « Routes » to see how far along each participant is. Without one, the map shows their positions only.`}
                        </p>
                    )}
                </SettingsCard>
            )}

            {enabled && (
                <>
                    <div className={classes.counts}>
                        <div className={classes.count}>
                            <strong style={{color: STATE_COLORS.running}}>{counts.running}</strong>
                            <span>{t`On the course`}</span>
                        </div>
                        <div className={classNames(classes.count, {[classes.countAlert]: counts.alert > 0})}>
                            <strong style={{color: STATE_COLORS.alert}}>{counts.alert}</strong>
                            <span>{t`To check`}</span>
                        </div>
                        <div className={classes.count}>
                            <strong>{counts.waiting}</strong>
                            <span>{t`Waiting for the start`}</span>
                        </div>
                        <div className={classes.count}>
                            <strong>{counts.finished}</strong>
                            <span>{t`Ended`}</span>
                        </div>
                    </div>

                    <div className={classes.board}>
                        <div className={classes.mapFrame}>
                            {courses.length > 1 && !selected && (
                                <div className={classes.courseTabs} role="tablist" aria-label={t`Routes`}>
                                    {courses.map((course, index) => (
                                        <Pill key={course.id} size="sm" role="tab" aria-selected={index === courseIndex}
                                              aria-pressed={undefined} active={index === courseIndex}
                                              onClick={() => setCourseIndex(index)}>
                                            {course.label}
                                        </Pill>
                                    ))}
                                </div>
                            )}
                            <LiveMap
                                course={shownCourse}
                                runners={runners}
                                selectedId={selectedId}
                                trail={selectedId ? trailQuery.data : undefined}
                                onSelect={setSelectedId}
                            />
                        </div>

                        <div className={classes.side}>
                            {selected && <RunnerDetails runner={selected} onClose={() => setSelectedId(null)}/>}

                            <section className={classes.list} aria-label={t`Participants`}>
                                {tracksQuery.isLoading && <Skeleton height={200} radius={16}/>}
                                {!tracksQuery.isLoading && runners.length === 0 && (
                                    <div className={classes.empty}>
                                        <IconBroadcast size={28} stroke={1.5}/>
                                        <p>{t`No participant shares their position yet. They do it from their ticket, usually just before the start.`}</p>
                                    </div>
                                )}
                                {runners.map((runner) => {
                                    const along = runner.position ? formatKm(runner.position.along) : runner.track.distance_m != null ? formatKm(runner.track.distance_m) : null;
                                    const pace = runner.state === 'running' || runner.state === 'alert' ? formatPace(runner.track.speed_mps) : null;
                                    const heartRate = runner.track.heart_rate;

                                    return (
                                        <button
                                            key={runner.track.id}
                                            type="button"
                                            className={classNames(classes.row, {[classes.rowSelected]: runner.track.id === selectedId})}
                                            onClick={() => setSelectedId(runner.track.id === selectedId ? null : runner.track.id)}
                                        >
                                            <span className={classes.badge} style={{background: STATE_COLORS[runner.state]}}>{runner.short}</span>
                                            <span className={classes.rowMain}>
                                                <span className={classes.rowName}>{runner.name}</span>
                                                <span className={classNames(classes.rowState, {[classes.stateAlert]: runner.state === 'alert'})}>
                                                    {stateLabel(runner)}
                                                </span>
                                            </span>
                                            <span className={classes.rowFigures}>
                                                {along && <strong>{along}</strong>}
                                                {pace && <span>{pace}</span>}
                                                {heartRate ? <span>{t`${heartRate} bpm`}</span> : null}
                                            </span>
                                        </button>
                                    );
                                })}
                            </section>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default LiveTracking;
