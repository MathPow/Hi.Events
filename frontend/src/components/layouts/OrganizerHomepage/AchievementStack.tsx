import {CSSProperties, PointerEvent, useEffect, useRef, useState} from "react";
import {t} from "@lingui/macro";
import {Popover, UnstyledButton} from "@mantine/core";
import {OrganizerEarnedAchievement} from "../../../types.ts";
import {achievementDefinition} from "../../common/OrganizerAchievements/achievements.ts";
import classes from "./AchievementStack.module.scss";

const SHOWN = 3;

const Disc = ({achievement, className}: { achievement: OrganizerEarnedAchievement, className: string }) => {
    const definition = achievementDefinition(achievement.key);
    const Icon = definition.icon;

    return (
        <span
            className={className}
            style={{
                '--achievement-badge': definition.badge,
                '--achievement-background': definition.background,
            } as CSSProperties}
            aria-hidden
        >
            {Icon && <Icon className={classes.discIcon} stroke={1.75}/>}
            {definition.label && (
                <span className={classes.discLabel} data-length={definition.label.length}>{definition.label}</span>
            )}
        </span>
    );
};

/**
 * Top left of the cover: the three hardest achievements the organizer has earned, overlapping
 * like profile pictures, then « +X » for the others. All of them on hover, or on tap on a phone.
 */
export const AchievementStack = ({achievements}: { achievements: OrganizerEarnedAchievement[] }) => {
    const [opened, setOpened] = useState(false);
    const closeTimer = useRef<number | undefined>(undefined);
    const lastPointer = useRef<string>('');

    useEffect(() => () => window.clearTimeout(closeTimer.current), []);

    if (achievements.length === 0) {
        return null;
    }

    const shown = achievements.slice(0, SHOWN);
    const others = achievements.length - shown.length;
    const label = `${t`Achievements earned`}: ${achievements.length}`;

    // With a mouse, the list follows the pointer from the stack to the list and back.
    const hover = (open: boolean) => (event: PointerEvent) => {
        if (event.pointerType !== 'mouse') {
            return;
        }
        window.clearTimeout(closeTimer.current);
        if (open) {
            setOpened(true);
        } else {
            closeTimer.current = window.setTimeout(() => setOpened(false), 150);
        }
    };

    return (
        <Popover
            opened={opened}
            onChange={setOpened}
            position="bottom-start"
            offset={10}
            width={340}
            shadow="md"
            classNames={{dropdown: classes.dropdown}}
        >
            <Popover.Target>
                <UnstyledButton
                    className={classes.stack}
                    aria-label={label}
                    data-opened={opened || undefined}
                    onPointerDown={(event) => {
                        lastPointer.current = event.pointerType;
                    }}
                    onPointerEnter={hover(true)}
                    onPointerLeave={hover(false)}
                    // The mouse already opened it on the way in; a tap or the keyboard opens and closes it.
                    onClick={() => setOpened((current) => lastPointer.current === 'mouse' ? true : !current)}
                >
                    {shown.map((achievement) => (
                        <Disc key={achievement.key} achievement={achievement} className={classes.disc}/>
                    ))}
                    {others > 0 && <span className={`${classes.disc} ${classes.more}`} aria-hidden>+{others}</span>}
                </UnstyledButton>
            </Popover.Target>

            <Popover.Dropdown onPointerEnter={hover(true)} onPointerLeave={hover(false)}>
                <p className={classes.heading}>
                    {t`Achievements earned`}
                    <span className={classes.count}>{achievements.length}</span>
                </p>
                <ul className={classes.list}>
                    {achievements.map((achievement) => {
                        const definition = achievementDefinition(achievement.key);

                        return (
                            <li key={achievement.key} className={classes.item}>
                                <Disc achievement={achievement} className={classes.itemDisc}/>
                                <span className={classes.itemText}>
                                    <strong>{definition.title}</strong>
                                    <span>{definition.description}</span>
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </Popover.Dropdown>
        </Popover>
    );
};
