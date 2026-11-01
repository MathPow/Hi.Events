import {ReactNode} from "react";
import {Collapse} from "@mantine/core";
import {IconChevronDown} from "@tabler/icons-react";
import classes from "./OrganizerHomepageDesigner.module.scss";

export type SectionId = 'images' | 'accent' | 'info' | 'social' | 'faq' | 'button';

interface DesignerSectionProps {
    id: SectionId;
    // A Ma page icon's name, or an image's address.
    icon: string;
    title: string;
    subtitle: ReactNode;
    open: boolean;
    onToggle: (id: SectionId) => void;
    children: ReactNode;
}

// A card of « Ma page »: closed by default, its header opens it.
export const DesignerSection = ({id, icon, title, subtitle, open, onToggle, children}: DesignerSectionProps) => (
    <section id={`ma-page-${id}`} className={classes.section} data-open={open || undefined}>
        <button
            type="button"
            className={classes.sectionHeader}
            aria-expanded={open}
            aria-controls={`ma-page-${id}-body`}
            onClick={() => onToggle(id)}
        >
            <span className={classes.pastille}>
                <img src={icon.startsWith('/') ? icon : `/interface/admin/ma-page/${icon}.svg`} alt=""/>
            </span>
            <span className={classes.sectionText}>
                <span className={classes.sectionTitle}>{title}</span>
                <span className={classes.sectionSubtitle}>{subtitle}</span>
            </span>
            <IconChevronDown className={classes.chevron} size={20} stroke={2}/>
        </button>
        <Collapse in={open} transitionDuration={200}>
            <div id={`ma-page-${id}-body`} className={classes.sectionBody}>
                {children}
            </div>
        </Collapse>
    </section>
);
