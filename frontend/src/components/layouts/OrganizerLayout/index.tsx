import {
    IconArrowsHorizontal,
    IconChevronRight,
    IconExternalLink,
    IconEyeOff,
    IconInbox,
    IconMessageQuestion,
    IconPlus,
    IconShare,
    IconShield,
    IconWebhook
} from "@tabler/icons-react";
import { t } from "@lingui/macro";
import { BreadcrumbItem, NavContext, NavItem } from "../AppLayout/types.ts";
import { adminIcon } from "../AppLayout/NavParts";
import AppLayout from "../AppLayout";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { Button, Menu, Modal, Stack, Text } from "@mantine/core";
import { useGetOrganizer } from "../../../queries/useGetOrganizer.ts";
import { useEffect, useRef, useState } from "react";
import { CreateEventModal } from "../../modals/CreateEventModal";
import { TopBarButton } from "../../common/TopBarButton";
import classes from "./OrganizerLayout.module.scss";
import { useDisclosure } from "@mantine/hooks";
import { SwitchOrganizerModal } from "../../modals/SwitchOrganizerModal";
import { CreateOrganizerModal } from "../../modals/CreateOrganizerModal";
import { useGetOrganizers } from "../../../queries/useGetOrganizers.ts";
import { useDashboardAttentionCount } from "../../routes/organizer/OrganizerDashboard/dashboardData.ts";
import { ShareModal } from "../../modals/ShareModal";
import { organizerHomepageUrl } from "../../../utilites/urlHelper";
import { useUpdateOrganizerStatus } from "../../../mutations/useUpdateOrganizerStatus.ts";
import { confirmationDialog } from "../../../utilites/confirmationDialog.tsx";
import { showError, showSuccess } from "../../../utilites/notifications.tsx";
import { useResendEmailConfirmation } from "../../../mutations/useResendEmailConfirmation.ts";
import { useGetMe } from "../../../queries/useGetMe.ts";
import { useCanSeeDeveloperPages, useIsCurrentUserSuperAdmin } from "../../../hooks/useIsCurrentUserAdmin.ts";
import { useGetOrganizerAchievements } from "../../../queries/useGetOrganizerAchievements.ts";
import { AchievementCelebration } from "../../common/OrganizerAchievements";
import {showStatusChangeError} from "../../common/EmailNotConfirmedError";
import { notifications } from "@mantine/notifications";
import { useGetOrganizerUnreadMessagesCount } from "../../../queries/useGetOrganizerMessages.ts";

const OrganizerLayout = () => {
    const { organizerId } = useParams();
    const location = useLocation();
    const { data: organizer } = useGetOrganizer(organizerId);
    const [showCreateEventModal, setShowCreateEventModal] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const [showCreateOrganizerModal, setShowCreateOrganizerModal] = useState(false);
    const [switchOrganizerModalOpen, { open: openSwitchModal, close: closeSwitchModal }] = useDisclosure(false);
    const [shareModalOpen, { open: openShareModal, close: closeShareModal }] = useDisclosure(false);
    const [emailVerificationModalOpen, {
        open: openEmailVerificationModal,
        close: closeEmailVerificationModal
    }] = useDisclosure(false);
    const { data: organizerResposne } = useGetOrganizers();
    const organizers = organizerResposne?.data;
    const resendEmailConfirmationMutation = useResendEmailConfirmation();
    const [emailConfirmationResent, setEmailConfirmationResent] = useState(false);
    const { data: me } = useGetMe();
    const isSuperAdmin = useIsCurrentUserSuperAdmin();
    const canSeeDeveloperPages = useCanSeeDeveloperPages();
    const isUserEmailVerfied = me?.is_email_verified;

    const { data: achievements } = useGetOrganizerAchievements(organizerId);
    const earnedAchievements = achievements?.filter((achievement) => achievement.earned_at).length;
    const statusToggleMutation = useUpdateOrganizerStatus();
    const navigate = useNavigate();

    // Les messages « Contacter » non lus: la pastille du menu, et une alerte quand un nouveau
    // arrive pendant que le tableau de bord est ouvert (hors de la page des messages).
    const { data: unreadMessages } = useGetOrganizerUnreadMessagesCount(organizerId);
    // Notifications of the dashboard still to handle: unread messages and payments to confirm.
    const dashboardAttention = useDashboardAttentionCount(organizerId);
    const previousUnreadMessages = useRef<number | undefined>(undefined);
    const isMessagesPage = location.pathname.endsWith('/messages');
    useEffect(() => {
        if (unreadMessages === undefined) {
            return;
        }
        const previous = previousUnreadMessages.current;
        previousUnreadMessages.current = unreadMessages;
        if (previous === undefined || unreadMessages <= previous || isMessagesPage) {
            return;
        }
        notifications.show({
            id: 'organizer-new-message',
            title: t`New message`,
            message: t`Someone wrote to you with the Contact button. Click to read it.`,
            icon: <IconInbox size={18}/>,
            autoClose: 8000,
            style: { cursor: 'pointer' },
            onClick: () => {
                notifications.hide('organizer-new-message');
                navigate(`/manage/organizer/${organizerId}/messages`);
            },
        });
    }, [unreadMessages]);

    // « Creer un evenement » a l'accueil mene ici avec ?create_event: on ouvre la fenetre de creation.
    useEffect(() => {
        if (searchParams.has('create_event')) {
            setShowCreateEventModal(true);
            searchParams.delete('create_event');
            setSearchParams(searchParams, {replace: true});
        }
    }, [searchParams]);

    const navItems: NavItem[] = [
        { label: t`Overview` },
        {
            link: 'dashboard',
            label: t`Dashboard`,
            iconSrc: adminIcon('accueil'),
            badge: dashboardAttention > 0 ? String(dashboardAttention) : undefined,
            attention: dashboardAttention > 0,
            mobileTab: true,
            mobileTabLabel: t`Home`,
            mobileTabOrder: 0,
        },
        {
            link: 'reports',
            label: t`Reports`,
            iconSrc: adminIcon('rapports'),
            isActive: (isActive) => isActive || location.pathname.includes('/report/'),
            mobileTab: true,
            mobileTabOrder: 2,
        },
        {
            link: 'achievements',
            label: t`Achievements`,
            iconSrc: adminIcon('succes'),
            tileIconSrc: adminIcon('succes-22'),
            badge: achievements ? `${earnedAchievements}/${achievements.length}` : null,
        },

        { label: t`Manage` },
        { link: 'events', label: t`Events`, iconSrc: adminIcon('evenements'), mobileTab: true, mobileTabOrder: 1 },
        {
            link: 'documents',
            label: t`Documents`,
            iconSrc: adminIcon('documents'),
            tileIconSrc: adminIcon('documents-22'),
            isActive: (isActive) => isActive || location.pathname.includes('/documents/'),
        },
        {
            link: 'messages',
            label: t`Messages`,
            iconSrc: adminIcon('messages'),
            tileIconSrc: adminIcon('messages-22'),
        },

        { label: t`Customize` },
        {
            link: 'organizer-homepage-designer',
            label: t`My page`,
            iconSrc: adminIcon('ma-page'),
            mobileTab: true,
            mobileTabOrder: 3,
        },
        {
            link: 'settings',
            label: t`Settings`,
            iconSrc: adminIcon('parametres'),
            tileIconSrc: adminIcon('parametres-22'),
        },
        // Pas encore integree a « Ma page » comme dans la maquette: on la garde a cote.
        { link: 'faq', label: t`FAQ`, icon: IconMessageQuestion },

        ...(canSeeDeveloperPages
            ? [
                { label: t`Integrations` },
                { link: 'webhooks', label: t`Webhooks`, icon: IconWebhook },
            ]
            : []),

        // Le tableau de bord admin n'existait que dans le menu de l'avatar, en
        // haut a droite: introuvable quand on cherche dans la barre laterale.
        // Les entetes de section s'affichent AVANT le filtre showWhen, d'ou le
        // spread conditionnel plutot qu'un showWhen sur chaque ligne.
        ...(isSuperAdmin
            ? [
                { label: t`Platform` },
                { link: '/admin', label: t`Admin Dashboard`, icon: IconShield },
            ]
            : []),
    ];

    const handleEmailConfirmationResend = () => {
        resendEmailConfirmationMutation.mutate({
            userId: me?.id
        }, {
            onSuccess: () => {
                showSuccess(t`Email confirmation resent successfully`);
                setEmailConfirmationResent(true);
            },
            onError: () => {
                showError(t`Something went wrong. Please try again.`);
            }
        })
    }

    const navItemsWithLoading: NavItem[] = navItems.map(item => {
        if (!organizer) {
            return {
                ...item,
                loading: true
            };
        }
        return item;
    });

    const handleStatusToggle = () => {
        // Check if user email is verified
        if (!isUserEmailVerfied) {
            openEmailVerificationModal();
            return;
        }

        const message = organizer?.status === 'LIVE'
            ? t`Are you sure you want to make this organizer draft? This will make the organizer page invisible to the public`
            : t`Are you sure you want to make this organizer public? This will make the organizer page visible to the public`;

        confirmationDialog(message, () => {
            statusToggleMutation.mutate({
                organizerId,
                status: organizer?.status === 'LIVE' ? 'DRAFT' : 'LIVE'
            }, {
                onSuccess: () => {
                    showSuccess(t`Organizer status updated`);
                },
                onError: (error: any) => {
                    showStatusChangeError(error, t`Organizer status update failed. Please try again later`);
                }
            });
        });
    };

    const publicPageUrl = `/events/${organizerId}/${organizer?.slug || ''}`;
    const hasSeveralOrganizers = !!organizers && organizers.length > 1;

    const navContext: NavContext = {
        initial: organizer?.name?.trim().charAt(0).toUpperCase() || '…',
        title: organizer?.name ?? '…',
        subtitle: t`Organizer`,
        mobileSubtitle: hasSeveralOrganizers ? t`Switch Organizer` : t`Organizer`,
        menu: organizer && (
            <>
                {hasSeveralOrganizers ? (
                    <Menu.Item leftSection={<IconArrowsHorizontal size={16} />} onClick={openSwitchModal}>
                        {t`Switch Organizer`}
                    </Menu.Item>
                ) : (
                    <Menu.Item leftSection={<IconPlus size={16} />} onClick={() => setShowCreateOrganizerModal(true)}>
                        {t`Create Organizer`}
                    </Menu.Item>
                )}
                <Menu.Divider />
                <Menu.Item component="a" href={publicPageUrl} target="_blank" rel="noopener"
                           leftSection={<IconExternalLink size={16} />}>
                    {t`View my page`}
                </Menu.Item>
                <Menu.Item leftSection={<IconShare size={16} />} onClick={openShareModal}>
                    {t`Share Organizer Page`}
                </Menu.Item>
            </>
        ),
    };

    const breadcrumbItems: BreadcrumbItem[] = [
        {
            link: `/manage/organizer/${organizerId}`,
            content: organizer?.name,
        },
    ];



    return (
        <>
            <AppLayout
                navItems={navItemsWithLoading}
                breadcrumbItems={breadcrumbItems}
                entityType="organizer"
                navContext={navContext}
                topBarContent={organizer?.status === 'DRAFT' && (
                    <TopBarButton
                        onClick={handleStatusToggle}
                        size="sm"
                        leftSection={<IconEyeOff size={16} />}
                        rightSection={<IconChevronRight size={14} />}
                    >
                        <span>{t`Draft`} <span className={classes.statusAction}>{t`- Click to Publish`}</span></span>
                    </TopBarButton>
                )}
                topBarActions={(
                    <Button
                        className={classes.createEventButton}
                        onClick={() => setShowCreateEventModal(true)}
                        leftSection={<IconPlus size={20} stroke={2.25} />}
                    >
                        {t`Create Event`}
                    </Button>
                )}
                mobileMenuItems={organizer ? [{
                    link: publicPageUrl,
                    external: true,
                    label: t`View my page`,
                    tileIconSrc: adminIcon('voir-22'),
                }] : []}
            />

            {organizer && (
                <AchievementCelebration organizerId={organizerId} currency={organizer.currency ?? 'CAD'} />
            )}
            {switchOrganizerModalOpen &&
                <SwitchOrganizerModal
                    opened={switchOrganizerModalOpen}
                    onClose={closeSwitchModal}
                    onCreateOrganizer={() => setShowCreateOrganizerModal(true)}
                />}
            {showCreateOrganizerModal && (
                <CreateOrganizerModal onClose={() => setShowCreateOrganizerModal(false)} />
            )}
            {organizer && shareModalOpen && (
                <ShareModal
                    url={organizerHomepageUrl(organizer)}
                    title={organizer.name}
                    modalTitle={t`Share Organizer Page`}
                    opened={shareModalOpen}
                    onClose={closeShareModal}
                />
            )}
            {showCreateEventModal && (
                <CreateEventModal
                    onClose={() => setShowCreateEventModal(false)}
                    organizerId={organizerId}
                />
            )}

            <Modal
                opened={emailVerificationModalOpen}
                onClose={closeEmailVerificationModal}
                title={t`Email Verification Required`}
                size="md"
                centered
            >
                <Stack gap="md">
                    <Text size="sm" c="dimmed">
                        {t`You must verify your email address before you can update the organizer status.`}
                    </Text>

                    {!emailConfirmationResent ? (
                        <Button
                            variant="light"
                            onClick={() => {
                                handleEmailConfirmationResend();
                            }}
                            loading={resendEmailConfirmationMutation.isPending}
                        >
                            {t`Resend Confirmation Email`}
                        </Button>
                    ) : (
                        <Text size="sm">
                            {t`Confirmation email sent! Please check your inbox.`}
                        </Text>
                    )}
                </Stack>
            </Modal>
        </>
    );
};

export default OrganizerLayout;
