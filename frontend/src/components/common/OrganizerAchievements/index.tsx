import {CSSProperties, useEffect, useRef, useState} from "react";
import {NavLink, useNavigate} from "react-router";
import {t} from "@lingui/macro";
import {Button, Modal, Progress, Tooltip} from "@mantine/core";
import {IconChevronRight, IconLock} from "@tabler/icons-react";
import {IdParam, OrganizerAchievementProgress} from "../../../types.ts";
import {useGetOrganizerAchievements} from "../../../queries/useGetOrganizerAchievements.ts";
import {useMarkOrganizerAchievementsSeen} from "../../../mutations/useMarkOrganizerAchievementsSeen.ts";
import {formatDateWithLocale} from "../../../utilites/dates.ts";
import {Card} from "../Card";
import {AchievementDefinition, achievementDefinition, nextAchievement, progressLabel} from "./achievements.ts";
import classes from "./OrganizerAchievements.module.scss";

type MedalSize = 'sm' | 'md' | 'lg' | 'xl';

const ICON_SIZES: Record<MedalSize, number> = {sm: 17, md: 26, lg: 36, xl: 50};

const medalStyle = (definition: AchievementDefinition) => ({
    '--medal-color': definition.color,
    '--medal-ink': definition.ink,
} as CSSProperties);

export const AchievementMedal = ({definition, earned, size = 'md'}: {
    definition: AchievementDefinition,
    earned: boolean,
    size?: MedalSize,
}) => {
    const Icon = definition.icon;

    return (
        <span
            className={classes.medal}
            data-size={size}
            data-earned={earned}
            style={medalStyle(definition)}
            role="img"
            aria-label={earned ? definition.title : t`${definition.title} (locked)`}
        >
            <Icon size={ICON_SIZES[size]} stroke={1.6} className={classes.medalIcon}/>
            {!earned && size !== 'sm' && (
                <span className={classes.medalLock}>
                    <IconLock size={size === 'md' ? 10 : 12} stroke={2.2}/>
                </span>
            )}
        </span>
    );
};

const earnedOn = (date: string, timezone: string) => formatDateWithLocale(date, 'shortDate', timezone);

export const AchievementCard = ({achievement, currency, timezone}: {
    achievement: OrganizerAchievementProgress,
    currency: string,
    timezone: string,
}) => {
    const definition = achievementDefinition(achievement.key, currency);
    const label = progressLabel(achievement, currency);
    const earned = !!achievement.earned_at;

    return (
        <div className={classes.card} data-earned={earned}>
            <AchievementMedal definition={definition} earned={earned} size="lg"/>
            <div className={classes.cardBody}>
                <h3 className={classes.cardTitle}>{definition.title}</h3>
                <p className={classes.cardDescription}>{definition.description}</p>
                {earned && (
                    <p className={classes.earnedOn}>{t`Earned on ${earnedOn(achievement.earned_at as string, timezone)}`}</p>
                )}
                {!earned && label && (
                    <div className={classes.progress}>
                        <Progress
                            value={Math.min(100, achievement.current / achievement.target * 100)}
                            color={definition.color}
                            size="sm"
                            radius="xl"
                            aria-label={label}
                        />
                        <span className={classes.progressLabel}>{label}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

/**
 * The organizer dashboard's card: the ten patches in a row, and the next one to get.
 */
export const AchievementsSummary = ({organizerId, currency}: { organizerId: IdParam, currency: string }) => {
    const {data: achievements} = useGetOrganizerAchievements(organizerId);

    if (!achievements) {
        return null;
    }

    const earnedCount = achievements.filter((achievement) => achievement.earned_at).length;
    const next = nextAchievement(achievements);
    const nextDefinition = next && achievementDefinition(next.key, currency);
    const nextLabel = next && progressLabel(next, currency);

    return (
        <Card className={classes.summary}>
            <div className={classes.summaryHeader}>
                <h3 className={classes.summaryTitle}>
                    {t`Achievements`}
                    <span className={classes.summaryCount}>{earnedCount}/{achievements.length}</span>
                </h3>
                <NavLink to={`/manage/organizer/${organizerId}/achievements`} className={classes.summaryLink}>
                    {t`View all`} <IconChevronRight size={14}/>
                </NavLink>
            </div>
            <div className={classes.summaryMedals}>
                {achievements.map((achievement) => {
                    const definition = achievementDefinition(achievement.key, currency);
                    return (
                        <Tooltip key={achievement.key} label={definition.title} withArrow>
                            <span>
                                <AchievementMedal definition={definition} earned={!!achievement.earned_at} size="sm"/>
                            </span>
                        </Tooltip>
                    );
                })}
            </div>
            {next && nextDefinition ? (
                <p className={classes.summaryNext}>
                    <span className={classes.summaryNextLabel}>{t`Next up:`}</span>{' '}
                    <strong>{nextDefinition.title}</strong>{' '}
                    {nextLabel ? `(${nextLabel})` : `— ${nextDefinition.description}`}
                </p>
            ) : (
                <p className={classes.summaryNext}>{t`Every achievement earned. Well done!`}</p>
            )}
        </Card>
    );
};

/**
 * Announces achievements earned since the organizer last looked, once, on whichever
 * organizer page they open next. They are marked as seen as soon as the window opens.
 */
export const AchievementCelebration = ({organizerId, currency}: { organizerId: IdParam, currency: string }) => {
    const {data: achievements} = useGetOrganizerAchievements(organizerId);
    const markSeen = useMarkOrganizerAchievementsSeen();
    const navigate = useNavigate();
    const [shown, setShown] = useState<OrganizerAchievementProgress[]>([]);
    // The list can be fetched again before the server has recorded them as seen.
    const announced = useRef(new Set<string>());

    useEffect(() => {
        const fresh = (achievements ?? []).filter((achievement) => achievement.is_new
            && !announced.current.has(`${organizerId}:${achievement.key}`));

        if (fresh.length === 0) {
            return;
        }

        fresh.forEach((achievement) => announced.current.add(`${organizerId}:${achievement.key}`));
        setShown(fresh);
        markSeen.mutate({organizerId});
    }, [achievements, organizerId]);

    const close = () => setShown([]);
    const single = shown.length === 1 ? achievementDefinition(shown[0].key, currency) : null;

    return (
        <Modal
            opened={shown.length > 0}
            onClose={close}
            centered
            withCloseButton={false}
            radius="lg"
            size={single ? 'sm' : 'md'}
            classNames={{body: classes.celebration}}
        >
            {single ? (
                <>
                    <div className={classes.celebrationMedal}>
                        <span className={classes.burst} style={medalStyle(single)}/>
                        <AchievementMedal definition={single} earned size="xl"/>
                    </div>
                    <p className={classes.celebrationEyebrow}>{t`Achievement unlocked!`}</p>
                    <h2 className={classes.celebrationTitle}>{single.title}</h2>
                    <p className={classes.celebrationDescription}>{single.description}</p>
                </>
            ) : (
                <>
                    <p className={classes.celebrationEyebrow}>{t`${shown.length} achievements unlocked!`}</p>
                    <div className={classes.celebrationGrid}>
                        {shown.map((achievement) => {
                            const definition = achievementDefinition(achievement.key, currency);
                            return (
                                <div key={achievement.key} className={classes.celebrationItem}>
                                    <AchievementMedal definition={definition} earned size="lg"/>
                                    <span className={classes.celebrationItemTitle}>{definition.title}</span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
            <div className={classes.celebrationActions}>
                <Button variant="subtle" color="gray" onClick={close}>{t`Continue`}</Button>
                <Button onClick={() => {
                    close();
                    navigate(`/manage/organizer/${organizerId}/achievements`);
                }}>
                    {t`See my achievements`}
                </Button>
            </div>
        </Modal>
    );
};
