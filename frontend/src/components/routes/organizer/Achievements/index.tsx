import {t} from "@lingui/macro";
import {Skeleton} from "@mantine/core";
import {useParams} from "react-router";
import dayjs from "dayjs";
import {AchievementBadge, achievementColors} from "../../../common/OrganizerAchievements";
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

const AchievementCard = ({achievement, timezone}: {
    achievement: OrganizerAchievementProgress,
    timezone: string,
}) => {
    const definition = achievementDefinition(achievement.key);
    const label = progressLabel(achievement);
    const earned = !!achievement.earned_at;

    return (
        <article className={classes.card} data-earned={earned} style={achievementColors(definition)}>
            <div className={classes.cardArt}>
                <AchievementBadge definition={definition} className={classes.cardBadge}/>
                {!earned && (
                    <span className={classes.lock} title={t`${definition.title} (locked)`}>
                        <img src="/interface/admin/succes/verrou.svg" alt=""/>
                    </span>
                )}
            </div>
            <div className={classes.cardBody}>
                <h2 className={classes.cardTitle}>{definition.title}</h2>
                <p className={classes.cardDescription}>{definition.description}</p>
                <div className={classes.cardFooter}>
                    {earned && (
                        <span className={classes.tag} data-tone="earned">
                            <span aria-hidden>✓ </span>
                            {t`Earned on ${earnedOn(achievement.earned_at as string, timezone)}`}
                        </span>
                    )}
                    {!earned && label && (
                        <>
                            <ProgressBar
                                className={classes.cardProgress}
                                value={achievement.current / achievement.target * 100}
                                label={label}
                            />
                            <span className={classes.cardProgressLabel}>{label}</span>
                        </>
                    )}
                    {!earned && !label && (
                        <span className={classes.tag}>{t({message: 'Locked', context: 'achievement'})}</span>
                    )}
                </div>
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
                    {[...Array(6)].map((_, index) => <Skeleton key={index} height={366} radius={28}/>)}
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
                {achievements.map((achievement) => (
                    <AchievementCard
                        key={achievement.key}
                        achievement={achievement}
                        timezone={organizer.timezone ?? 'America/Montreal'}
                    />
                ))}
            </div>
        </div>
    );
};

export default Achievements;
