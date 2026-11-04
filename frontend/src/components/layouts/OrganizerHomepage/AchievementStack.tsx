import {CSSProperties, PointerEvent, ReactNode, useEffect, useMemo, useRef, useState} from "react";
import {t} from "@lingui/macro";
import {Popover, UnstyledButton} from "@mantine/core";
import {OrganizerEarnedAchievement} from "../../../types.ts";
import {achievementDefinition} from "../../common/OrganizerAchievements/achievements.ts";
import {roughButtonPath} from "../../../hooks/useRoughButton.ts";
import classes from "./AchievementStack.module.scss";

const SHOWN = 3;

// The discs are drawn at the size of the stack's (smaller ones scale the drawing), with a ring
// of RING px around them that follows the same rough edge.
const SIZE = 46;
const RING = 3;
// The harder the achievement, the rougher its edge, up to « Nice club » (the hardest of the 13):
// the bumps of the site's round buttons, scaled from MIN_ROUGHNESS to MAX_ROUGHNESS.
const HARDEST = 13;
const MIN_ROUGHNESS = 0.4;
const MAX_ROUGHNESS = 1.5;

const roughnessOf = (difficulty: number) =>
    MIN_ROUGHNESS + (MAX_ROUGHNESS - MIN_ROUGHNESS) * Math.min(1, Math.max(0, (difficulty - 1) / (HARDEST - 1)));

// The same cut for the same achievement, on the server and in the browser.
const seedOf = (text: string) =>
    [...text].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);

const RoughDisc = ({seed, roughness, className, style, children}: {
    seed: number,
    roughness: number,
    className: string,
    style?: CSSProperties,
    children: ReactNode,
}) => {
    const path = useMemo(
        () => roughButtonPath(SIZE, SIZE, seed, {radius: SIZE / 2, round: true, scale: roughness}),
        [seed, roughness],
    );
    const center = SIZE / 2;

    return (
        <span className={className} style={style} aria-hidden>
            <svg className={classes.discShape} viewBox={`0 0 ${SIZE} ${SIZE}`}>
                <path d={path} className={classes.discRing}/>
                <path d={path} className={classes.discFill}
                      transform={`translate(${center} ${center}) scale(${(SIZE - 2 * RING) / SIZE}) translate(${-center} ${-center})`}/>
            </svg>
            {children}
        </span>
    );
};

const Disc = ({achievement, className}: { achievement: OrganizerEarnedAchievement, className: string }) => {
    const definition = achievementDefinition(achievement.key);
    const Icon = definition.icon;

    return (
        <RoughDisc
            seed={seedOf(achievement.key)}
            roughness={roughnessOf(achievement.difficulty)}
            className={className}
            style={{
                '--achievement-badge': definition.badge,
                '--achievement-background': definition.background,
            } as CSSProperties}
        >
            {Icon && <Icon className={classes.discIcon} stroke={1.75}/>}
            {definition.label && (
                <span className={classes.discLabel} data-length={definition.label.length}>{definition.label}</span>
            )}
        </RoughDisc>
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
                    {others > 0 && (
                        <RoughDisc seed={seedOf('more')} roughness={MIN_ROUGHNESS} className={`${classes.disc} ${classes.more}`}>
                            <span className={classes.moreLabel}>+{others}</span>
                        </RoughDisc>
                    )}
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
                                <Disc achievement={achievement} className={`${classes.disc} ${classes.itemDisc}`}/>
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
