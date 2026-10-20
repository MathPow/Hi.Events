import React, {useEffect, useRef} from "react";
import {UnstyledButton} from "@mantine/core";
import {IconProps} from "@tabler/icons-react";
import classNames from "classnames";
import classes from './SettingsSectionChips.module.scss';

export interface SettingsSection {
    id: string;
    label: string;
    icon: React.ComponentType<IconProps>;
    color?: string;
}

interface SettingsSectionChipsProps {
    sections: SettingsSection[];
    activeSection: string;
    onSelect: (sectionId: string) => void;
}

export const SettingsSectionChips = ({sections, activeSection, onSelect}: SettingsSectionChipsProps) => {
    const scrollerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const scroller = scrollerRef.current;
        const chip = scroller?.querySelector<HTMLElement>(`[data-section="${activeSection}"]`);
        if (scroller && chip) {
            scroller.scrollTo({
                left: chip.offsetLeft - (scroller.clientWidth - chip.offsetWidth) / 2,
                behavior: 'smooth',
            });
        }
    }, [activeSection]);

    return (
        <div className={classes.bar}>
            <div className={classes.scroller} ref={scrollerRef}>
                {sections.map((section) => (
                    <UnstyledButton
                        key={section.id}
                        data-section={section.id}
                        className={classNames(classes.chip, {
                            [classes.active]: activeSection === section.id,
                            [classes.danger]: section.color === 'red',
                        })}
                        aria-current={activeSection === section.id ? 'true' : undefined}
                        onClick={() => onSelect(section.id)}
                    >
                        <section.icon size={16} stroke={1.75}/>
                        <span>{section.label}</span>
                    </UnstyledButton>
                ))}
            </div>
        </div>
    );
};
