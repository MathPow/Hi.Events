import { SeoSettings } from "./Sections/SeoSettings";
import BasicSettings from "./Sections/BasicSettings";
import { SocialLinks } from "./Sections/SocialLinks";
import { AddressSettings } from "./Sections/AddressSettings";
import EmailTemplateSettings from "./Sections/EmailTemplateSettings";
import { EventDefaults } from "./Sections/EventDefaults";
import { PlatformFeesSettings } from "./Sections/PlatformFeesSettings";
import { DangerZoneSettings } from "./Sections/DangerZoneSettings";
import { TrackingPixelSettings } from "./Sections/TrackingPixelSettings";
import { CharitySettings } from "./Sections/CharitySettings";
import { PageBody } from "../../../common/PageBody";
import { PageTitle } from "../../../common/PageTitle";
import { t } from "@lingui/macro";
import { Box, Group, NavLink as MantineNavLink, Stack } from "@mantine/core";
import { IconAlertTriangle, IconBrandGoogleAnalytics, IconInfoCircle, IconMapPin, IconShare, IconMail, IconCalendarEvent, IconPercentage, IconChartBar, IconReceipt2, IconCreditCard, IconHeartHandshake } from "@tabler/icons-react";
import { useMediaQuery } from "@mantine/hooks";
import { SettingsSectionChips } from "../../../common/SettingsSectionChips";
import { useScrollSpy } from "../../../../hooks/useScrollSpy.ts";
import { useMemo, useState } from "react";
import { Card } from "../../../common/Card";
import { useParams } from "react-router";
import { PaymentSettings } from "./Sections/PaymentSettings";
import { PlatformSupportSettings } from "./Sections/PlatformSupportSettings";
import { platformSupportEnabled } from "../../../common/PlatformSupportInput";
import { useGetAccount } from "../../../../queries/useGetAccount.ts";

// Jusqu'a ce taux de frais compris, la contribution des acheteurs est toujours proposee et
// l'organisateur n'a pas le choix (PlatformSupportService::ALWAYS_ON_UP_TO_FEE_PERCENT).
const PLATFORM_SUPPORT_ALWAYS_ON_UP_TO_FEE_PERCENT = 1.5;

const Settings = () => {
    const { organizerId } = useParams();
    const { data: account } = useGetAccount();
    const isSaasMode = account?.is_saas_mode_enabled;
    const feePercentage = account?.configuration ? Number(account.configuration.application_fees?.percentage ?? 0) : null;
    const platformSupportChoice = platformSupportEnabled()
        && feePercentage !== null && feePercentage > PLATFORM_SUPPORT_ALWAYS_ON_UP_TO_FEE_PERCENT;

    const SECTIONS = useMemo(() => {
        const baseSections = [
            {
                id: 'basic-settings',
                label: t`Basic Information`,
                icon: IconInfoCircle,
                component: BasicSettings
            },
            {
                id: 'event-defaults',
                label: t`Event Defaults`,
                icon: IconCalendarEvent,
                component: EventDefaults
            },
            {
                id: 'address-settings',
                label: t`Address`,
                icon: IconMapPin,
                component: AddressSettings
            },
            {
                id: 'payment-settings',
                label: t`Payments`,
                icon: IconCreditCard,
                component: PaymentSettings
            },
            {
                id: 'charity-settings',
                label: t`Tax receipts`,
                icon: IconReceipt2,
                component: CharitySettings
            },
            // {
            //     id: 'image-assets',
            //     label: t`Images & Branding`,
            //     icon: IconPhoto,
            //     component: ImageAssetSettings
            // },
            {
                id: 'social-links',
                label: t`Social Links`,
                icon: IconShare,
                component: SocialLinks
            },
            {
                id: 'seo-settings',
                label: t`SEO`,
                icon: IconBrandGoogleAnalytics,
                component: SeoSettings
            },
            {
                id: 'email-templates',
                label: t`Email Templates`,
                icon: IconMail,
                component: () => <EmailTemplateSettings organizerId={organizerId!} />
            },
            {
                id: 'tracking-pixels',
                label: t`Tracking & Analytics`,
                icon: IconChartBar,
                component: TrackingPixelSettings,
            },
            {
                id: 'danger-zone',
                label: t`Danger Zone`,
                icon: IconAlertTriangle,
                component: DangerZoneSettings,
                color: 'red',
            },
        ];

        if (platformSupportChoice) {
            baseSections.splice(baseSections.findIndex(section => section.id === 'payment-settings') + 1, 0, {
                id: 'platform-support',
                label: t`Platform contribution`,
                icon: IconHeartHandshake,
                component: PlatformSupportSettings,
            });
        }

        if (isSaasMode) {
            baseSections.splice(2, 0, {
                id: 'platform-fees',
                label: t`Platform Fees`,
                icon: IconPercentage,
                component: PlatformFeesSettings,
            });
        }

        return baseSections;
    }, [isSaasMode, organizerId, platformSupportChoice]);

    const isLargeScreen = useMediaQuery('(min-width: 1200px)', true);
    const [activeSection, setActiveSection] = useState('basic-settings');

    const handleClick = (sectionId: string) => {
        setActiveSection(sectionId);
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    };

    useScrollSpy(SECTIONS.map((section) => section.id), setActiveSection, !isLargeScreen);

    const sideMenu = (
        <Card style={{ padding: '15px', marginBottom: 0 }}>
            <Stack gap="xs">
                {SECTIONS.map((section) => (
                    <MantineNavLink
                        key={section.id}
                        active={activeSection === section.id}
                        label={section.label}
                        color={'color' in section ? section.color as string : undefined}
                        leftSection={<section.icon size={16} stroke={1.5} />}
                        onClick={() => handleClick(section.id)}
                    />
                ))}
            </Stack>
        </Card>
    );

    const content = SECTIONS.map(({ id, component: Component }) => (
        <div key={id} id={id} style={{ scrollMarginTop: isLargeScreen ? '20px' : '72px' }}>
            <Component />
        </div>
    ));

    return (
        <PageBody>
            <PageTitle>{t`Organizer Settings`}</PageTitle>

            {isLargeScreen ? (
                <Group align="flex-start" gap="md">
                    <Box w={240} style={{ position: 'sticky', top: 20 }}>
                        {sideMenu}
                    </Box>
                    <Box style={{ flex: 1 }}>{content}</Box>
                </Group>
            ) : (
                <Stack>
                    <SettingsSectionChips sections={SECTIONS} activeSection={activeSection} onSelect={handleClick} />
                    {content}
                </Stack>
            )}
        </PageBody>
    );
}

export default Settings;
