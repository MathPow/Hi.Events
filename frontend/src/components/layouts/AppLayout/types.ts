import React, { ReactNode } from 'react';
import { TablerIconsProps } from '@tabler/icons-react';

export interface NavItem {
    link?: string;
    label: string;
    icon?: React.ComponentType<TablerIconsProps>;
    comingSoon?: boolean;
    isActive?: (isActive: boolean) => boolean;
    badge?: string | number | null | undefined;
    // Something on this page still needs to be done: shows an orange dot, or makes the badge orange.
    attention?: boolean;
    onClick?: () => void;
    showWhen?: () => boolean | undefined;
    loading?: boolean;
    // Shown in the bottom tab bar on phones; everything else goes in the "More" sheet.
    mobileTab?: boolean;
    mobileTabLabel?: string;
}

export interface MobileContext {
    title: ReactNode;
    subtitle?: ReactNode;
    backLink?: string;
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
