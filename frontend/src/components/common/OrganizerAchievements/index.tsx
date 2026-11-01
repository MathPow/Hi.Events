import {CSSProperties, useEffect, useRef, useState} from "react";
import {useNavigate} from "react-router";
import {t} from "@lingui/macro";
import {Button, Modal} from "@mantine/core";
import {IdParam, OrganizerAchievementProgress} from "../../../types.ts";
import {useGetOrganizerAchievements} from "../../../queries/useGetOrganizerAchievements.ts";
import {useMarkOrganizerAchievementsSeen} from "../../../mutations/useMarkOrganizerAchievementsSeen.ts";
import {AchievementDefinition, achievementDefinition} from "./achievements.ts";
import classes from "./OrganizerAchievements.module.scss";

export const achievementColors = (definition: AchievementDefinition) => ({
    '--achievement-background': definition.background,
    '--achievement-badge': definition.badge,
} as CSSProperties);

/**
 * The badge of an achievement: its icon on a disc of its colour, in a pale ring.
 * A placeholder until the real illustrations are drawn. Its size comes from --badge-size.
 */
export const AchievementBadge = ({definition, className}: {
    definition: AchievementDefinition,
    className?: string,
}) => {
    const Icon = definition.icon;

    return (
        <span
            className={className ? `${classes.badge} ${className}` : classes.badge}
            style={achievementColors(definition)}
            aria-hidden
        >
            <span className={classes.badgeDisc}>
                <Icon stroke={1.1} className={classes.badgeIcon}/>
            </span>
        </span>
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
                    <div className={classes.celebrationBadge} style={achievementColors(single)}>
                        <span className={classes.burst}/>
                        <AchievementBadge definition={single}/>
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
                                    <AchievementBadge definition={definition}/>
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
