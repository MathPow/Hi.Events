import React, { ReactNode } from 'react';
import { TablerIconsProps } from '@tabler/icons-react';

export interface NavItem {
    link?: string;
    label: string;
    icon?: React.ComponentType<TablerIconsProps>;
    // The DEHORS icons drawn for the nav (public/interface/admin), used instead of `icon` when set.
    iconSrc?: string;
    // Larger version for the tiles of the phone menu.
    tileIconSrc?: string;
    // Opens in a new tab (public pages).
    external?: boolean;
    comingSoon?: boolean;
    isActive?: (isActive: boolean) => boolean;
    badge?: string | number | null | undefined;
    // Something on this page still needs to be done: shows an orange dot, or makes the badge orange.
    attention?: boolean;
    onClick?: () => void;
    showWhen?: () => boolean | undefined;
    loading?: boolean;
    // Shown in the bottom tab bar on phones; everything else goes in the menu card.
    mobileTab?: boolean;
    mobileTabLabel?: string;
    // Tabs follow the nav order unless given a place here.
    mobileTabOrder?: number;
    // Shorter name in the breadcrumbs, where the event already says whose page it is.
    crumbLabel?: string;
}

// The organizer (or event) at the top of the sidebar and of the phone menu.
export interface NavContext {
    initial: string;
    title: ReactNode;
    subtitle?: ReactNode;
    // Subtitle in the phone menu, where the card is the way to switch organizer.
    mobileSubtitle?: ReactNode;
    // Menu.Item entries opened by the card; without them the card is a plain label.
    menu?: ReactNode;
    // An event (Figma « Événement actif »): a small label above, its cover instead of the initial.
    overline?: string;
    imageUrl?: string;
    // The way back to the list, above the card (« ‹ Dehors · Tous les événements »).
    backLink?: { to: string, label: string };
    // A long list (Figma « Barre latérale · Événement »): tighter rows, so it fits without scrolling.
    compact?: boolean;
}

export interface MobilePrimaryAction {
    label: string;
    icon: React.ComponentType<TablerIconsProps>;
    onClick: () => void;
}

export interface BreadcrumbItem {
    link?: string;
    content: ReactNode;
}

export interface StatusToggleConfig {
    status: 'DRAFT' | 'LIVE';
    onToggle: () => void;
    statusMessages?: {
        draft?: string;
        live?: string;
    };
}
