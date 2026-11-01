import {Accordion as MantineAccordion, Group, Text} from '@mantine/core';
import classes from './Accordion.module.scss';
import React from "react";

export interface AccordionItem {
    value: string;
    icon?: React.ElementType;
    title: string;
    count?: number;
    hidden?: boolean;
    content: React.ReactNode;
}

interface AccordionProps {
    items: AccordionItem[];
    defaultValue?: string;
}

export const Accordion = ({items, defaultValue}: AccordionProps) => {
    return (
        <MantineAccordion
            variant="separated"
            defaultValue={defaultValue}
            classNames={{
                item: classes.accordionItem,
                control: classes.accordionControl,
                content: classes.accordionContent,
                chevron: classes.accordionChevron
            }}
        >
            {items
                .filter((item) => !item.hidden)
                .map((item) => (
                    <MantineAccordion.Item key={item.value} value={item.value}>
                        <MantineAccordion.Control>
                            <Group gap="xs">
                                {item.icon && <item.icon size={20} stroke={2}/>}
                                <Text className={classes.accordionTitle}>{item.title}</Text>
                                {item.count !== undefined && (
                                    <span className={classes.accordionCount}>{item.count}</span>
                                )}
                            </Group>
                        </MantineAccordion.Control>
                        <MantineAccordion.Panel>
                            {item.content}
                        </MantineAccordion.Panel>
                    </MantineAccordion.Item>
                ))}
        </MantineAccordion>
    );
};
