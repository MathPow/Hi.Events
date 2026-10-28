import {t} from "@lingui/macro";
import {Progress, Skeleton} from "@mantine/core";
import {useParams} from "react-router";
import {PageBody} from "../../../common/PageBody";
import {PageTitle} from "../../../common/PageTitle";
import {Card} from "../../../common/Card";
import {AchievementCard} from "../../../common/OrganizerAchievements";
import {useGetOrganizer} from "../../../../queries/useGetOrganizer.ts";
import {useGetOrganizerAchievements} from "../../../../queries/useGetOrganizerAchievements.ts";
import classes from "./Achievements.module.scss";

const Achievements = () => {
    const {organizerId} = useParams();
    const {data: organizer} = useGetOrganizer(organizerId);
    const {data: achievements} = useGetOrganizerAchievements(organizerId);

    if (!organizer || !achievements) {
        return (
            <PageBody>
                <PageTitle>{t`Achievements`}</PageTitle>
                <Skeleton height={96} radius="md" mb="lg"/>
                <div className={classes.grid}>
                    {[...Array(10)].map((_, index) => <Skeleton key={index} height={132} radius="md"/>)}
                </div>
            </PageBody>
        );
    }

    const earnedCount = achievements.filter((achievement) => achievement.earned_at).length;
    const total = achievements.length;

    return (
        <PageBody>
            <PageTitle>{t`Achievements`}</PageTitle>
            <Card className={classes.overview}>
                <p className={classes.intro}>
                    {t`Each achievement marks a step in your journey as an organizer, from your first event to a full season.`}
                </p>
                <div className={classes.overall}>
                    <Progress value={earnedCount / total * 100} size="lg" radius="xl" color="var(--dehors-orange)"
                              aria-label={t`Achievements earned`}/>
                    <span className={classes.overallLabel}>{t`${earnedCount} of ${total} earned`}</span>
                </div>
            </Card>
            <div className={classes.grid}>
                {achievements.map((achievement) => (
                    <AchievementCard
                        key={achievement.key}
                        achievement={achievement}
                        currency={organizer.currency ?? 'CAD'}
                        timezone={organizer.timezone ?? 'America/Montreal'}
                    />
                ))}
            </div>
        </PageBody>
    );
};

export default Achievements;
