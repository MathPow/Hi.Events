import {CSSProperties} from "react";
import {t} from "@lingui/macro";
import {Skeleton} from "@mantine/core";
import {IconCheck, IconLock} from "@tabler/icons-react";
import {useParams} from "react-router";
import dayjs from "dayjs";
import {
    achievementDefinition,
    nextAchievement,
    progressLabel,
} from "../../../common/OrganizerAchievements/achievements.ts";
import {useGetOrganizer} from "../../../../queries/useGetOrganizer.ts";
import {useGetOrganizerAchievements} from "../../../../queries/useGetOrganizerAchievements.ts";
import {OrganizerAchievementProgress} from "../../../../types.ts";
import {formatDateWithLocale} from "../../../../utilites/dates.ts";
import classes from "./Achievements.module.scss";

// « 2 oct. », with the year when it isn't this one.
const earnedOn = (date: string, timezone: string) => {
    const sameYear = dayjs.utc(date).tz(timezone).year() === dayjs().tz(timezone).year();
    return formatDateWithLocale(date, sameYear ? 'chartDate' : 'shortDate', timezone);
};

const ProgressBar = ({value, label, className}: { value: number, label: string, className: string }) => (
    <div
        className={className}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
        aria-label={label}
    >
        <span style={{width: `${Math.min(100, value)}%`}}/>
    </div>
);

// Cards barely crooked (between -0.8° and +0.8°), always the same for the same place: only the
// look turns, each card keeps its place in the grid.
const TILTS = [0.8, -0.6, 0.5, -0.7, 0.6, -0.5, 0.7, -0.8, 0.4, -0.6, 0.3, -0.4, 0.6];

/**
 * Figma « Admin · Succès »: one card per achievement, like a collection. Earned, a solid colour
 * with its badge (a placeholder until Jules draws them), « Obtenu le … » at the top; not yet, a
 * dashed outline with an orange padlock and the progress.
 */
const AchievementCard = ({achievement, timezone, index}: {
    achievement: OrganizerAchievementProgress,
    timezone: string,
    index: number,
}) => {
    const definition = achievementDefinition(achievement.key);
    const label = progressLabel(achievement);
    const earned = !!achievement.earned_at;
    const Icon = definition.icon;
    const title = definition.title;
    const earnedDate = earned ? earnedOn(achievement.earned_at as string, timezone) : '';
    const style = {
        '--card-tilt': `${TILTS[index % TILTS.length]}deg`,
        '--card-color': definition.card ?? definition.background,
    } as CSSProperties;

    return (
        <article className={classes.card} data-earned={earned || undefined}
                 data-dark={(earned && !!definition.card) || undefined} style={style}>
            <span className={classes.status}>
                {earned ? (
                    <>
                        <IconCheck size={14} stroke={2.5}/>
                        {t`Earned on ${earnedDate}`}
                    </>
                ) : (
                    <>
                        <IconLock size={14} stroke={2.25}/>
                        {label ?? t({message: 'Locked', context: 'achievement'})}
                    </>
                )}
            </span>

            <div className={classes.art}>
                {earned ? (
                    <span className={classes.badge} aria-hidden>
                        <span className={classes.badgeInner}>
                            {Icon && <Icon size={52} stroke={1.5}/>}
                            {definition.label && (
                                <span className={classes.badgeLabel} data-length={definition.label.length}>
                                    {definition.label}
                                </span>
                            )}
                        </span>
                    </span>
                ) : (
                    <span className={classes.lock} title={t`${title} (locked)`}>
                        <IconLock size={46} stroke={1.5}/>
                    </span>
                )}
            </div>

            <div className={classes.text}>
                <h2 className={classes.cardTitle}>{definition.title}</h2>
                <p className={classes.cardDescription}>{definition.description}</p>
            </div>
        </article>
    );
};

const Achievements = () => {
    const {organizerId} = useParams();
    const {data: organizer} = useGetOrganizer(organizerId);
    const {data: achievements} = useGetOrganizerAchievements(organizerId);

    const header = (
        <header className={classes.header}>
            <h1 className={classes.title}>{t`Achievements`}</h1>
            <p className={`${classes.subtitle} ${classes.desktopOnly}`}>
                {t`Each achievement marks a step in your journey as an organizer, from your first event to the biggest crowds.`}
            </p>
            <p className={`${classes.subtitle} ${classes.mobileOnly}`}>
                {t`The milestones of your journey as an organizer.`}
            </p>
        </header>
    );

    if (!organizer || !achievements) {
        return (
            <div className={classes.page}>
                {header}
                <Skeleton height={130} radius={32}/>
                <div className={classes.grid}>
                    {[...Array(6)].map((_, index) => <Skeleton key={index} height={464} radius={28}/>)}
                </div>
            </div>
        );
    }

    const earnedCount = achievements.filter((achievement) => achievement.earned_at).length;
    const total = achievements.length;
    const next = nextAchievement(achievements);
    const nextDefinition = next && achievementDefinition(next.key);

    return (
        <div className={classes.page}>
            {header}

            <section className={classes.overview}>
                <div className={classes.count}>
                    <span className={classes.countValue}>{earnedCount} / {total}</span>
                    <span className={classes.countLabel}>{t`achievements earned`}</span>
                </div>
                <div className={classes.overviewMain}>
                    <ProgressBar
                        className={classes.overallProgress}
                        value={total ? earnedCount / total * 100 : 0}
                        label={t`Achievements earned`}
                    />
                    {nextDefinition ? (
                        <p className={classes.next}>
                            <span>{t`Next up:`}</span>
                            <strong>{nextDefinition.title}</strong>
                            <span>· {nextDefinition.description}</span>
                        </p>
                    ) : (
                        <p className={classes.next}>{t`Every achievement earned. Well done!`}</p>
                    )}
                </div>
            </section>

            <div className={classes.grid}>
                {achievements.map((achievement, index) => (
                    <AchievementCard
                        key={achievement.key}
                        achievement={achievement}
                        index={index}
                        timezone={organizer.timezone ?? 'America/Montreal'}
                    />
                ))}
            </div>
        </div>
    );
};

export default Achievements;
