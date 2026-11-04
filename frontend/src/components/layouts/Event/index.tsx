import {
    IconArrowLeft,
    IconChevronRight,
    IconDeviceTabletCode,
    IconExternalLink,
    IconEye,
    IconEyeOff,
    IconMailCheck,
    IconMailForward,
    IconShare,
    IconWebhook,
    IconShieldLock,
} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import {getProductsFromEvent} from "../../../utilites/helpers.ts";
import {useGetEvent} from "../../../queries/useGetEvent";
import {useGetEventSettings} from "../../../queries/useGetEventSettings";
import {useGetEventImages} from "../../../queries/useGetEventImages.ts";
import {useCanSeeDeveloperPages} from "../../../hooks/useIsCurrentUserAdmin.ts";
import {BreadcrumbItem, NavContext, NavItem} from "../AppLayout/types.ts";
import {adminIcon} from "../AppLayout/NavParts";
import AppLayout from "../AppLayout";
import {NavLink, useLocation, useParams} from "react-router";
import classes from './Event.module.scss';
import {Button, Menu} from "@mantine/core";
import {confirmationDialog} from "../../../utilites/confirmationDialog.tsx";
import {useUpdateEventStatus} from "../../../mutations/useUpdateEventStatus.ts";
import {showError, showSuccess} from "../../../utilites/notifications.tsx";
import {ShareModal} from "../../modals/ShareModal";
import {EventLiveCelebrationModal} from "../../modals/EventLiveCelebrationModal";
import {useDisclosure} from "@mantine/hooks";
import {TopBarButton} from "../../common/TopBarButton";
import {SidebarCallout} from "../../common/SidebarCallout";
import {useGetMe} from "../../../queries/useGetMe.ts";
import {useResendEmailConfirmation} from "../../../mutations/useResendEmailConfirmation.ts";
import {useState} from "react";
import {eventHomepageUrl} from "../../../utilites/urlHelper.ts";
import {showStatusChangeError} from "../../common/EmailNotConfirmedError";
import {PublicIcon} from "../../common/PublicIcon";
import {eventStartLabel} from "../../../utilites/eventStartLabel.ts";
import {EventSwitcherMenu} from "./EventSwitcherMenu.tsx";
import {useEventNotifications} from "../../routes/event/EventDashboard/eventNotifications.ts";

const navIcon = (name: string) => adminIcon(`nav-evenement/${name}`);

const EventLayout = () => {
    const location = useLocation();
    const {eventId} = useParams();

    const [opened, {open, close}] = useDisclosure(false);
    const [celebrationOpened, {open: openCelebration, close: closeCelebration}] = useDisclosure(false);

    const statusToggleMutation = useUpdateEventStatus();

    const {data: event, isFetched: isEventFetched} = useGetEvent(eventId);
    const {isFetched: isEventSettingsFetched} = useGetEventSettings(eventId);
    const {data: eventImages, isFetched: isEventImagesFetched} = useGetEventImages(eventId);
    const canSeeDeveloperPages = useCanSeeDeveloperPages();
    const {data: me} = useGetMe();

    const resendEmailConfirmationMutation = useResendEmailConfirmation();
    const [emailConfirmationResent, setEmailConfirmationResent] = useState(false);

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

    const products = getProductsFromEvent(event);
    const hasDeposits = !!products?.some(product => (product.deposit_amount || 0) > 0);

    // The steps of the dashboard's « Préparez votre événement »: point to the pages that still need work.
    const isSetupStatusKnown = isEventFetched && isEventImagesFetched;
    const needsProducts = isSetupStatusKnown && !products?.length;
    const needsDetails = isSetupStatusKnown && !event?.description;
    const needsImages = isSetupStatusKnown && !eventImages?.length;
    // The dashboard's notifications still to handle: messages, payments to confirm, tickets almost gone.
    const {toHandleCount} = useEventNotifications(eventId, event);

    // Figma « Admin · Barre latérale · Événement ». Its notes retire Affiliates and Capacity Management:
    // both pages still exist (by URL, and from the product form for capacities).
    const navItems: NavItem[] = [
        // 1. OVERVIEW
        {label: t`Overview`},
        {
            link: 'dashboard',
            label: t`Dashboard`,
            iconSrc: navIcon('accueil'),
            badge: toHandleCount > 0 ? String(toHandleCount) : undefined,
            attention: toHandleCount > 0,
            mobileTab: true,
            mobileTabLabel: t`Overview`,
        },
        {
            link: 'reports',
            label: t`Reports`,
            iconSrc: navIcon('rapports'),
            isActive: (isActive) => isActive || location.pathname.includes('/report/')
        },

        // 2. TICKETING
        {label: t`Ticketing`},
        {link: 'products', label: t`Tickets & Products`, iconSrc: navIcon('billets'), attention: needsProducts},
        // « Commandes » holds the participants too (Figma « Commandes et participants »): one entry for both.
        {
            link: 'orders',
            label: t`Orders`,
            iconSrc: navIcon('commandes'),
            mobileTab: true,
            isActive: (isActive) => isActive || /\/attendees\/?$/.test(location.pathname),
        },
        // Only where tickets have a deposit: the one place to return or retain it.
        ...(hasDeposits ? [{link: 'deposits', label: t`Deposits`, icon: IconShieldLock}] : []),
        {link: 'promo-codes', label: t`Promo Codes`, iconSrc: navIcon('codes-promo')},
        {link: 'sold-out-waitlist', label: t`Waitlist`, iconSrc: navIcon('liste-attente')},

        // 3. ON SITE
        {label: t`On site`},
        {link: 'check-in', label: t`Check-in and scanning`, iconSrc: navIcon('scan'), mobileTab: true, mobileTabLabel: t`Check-in`},

        // 4. CONFIGURATION
        {label: t`Configuration`},
        {
            link: 'settings',
            label: t`Settings`,
            iconSrc: navIcon('parametres'),
            tileIconSrc: adminIcon('parametres-22'),
            attention: needsDetails,
        },
        {link: 'homepage-designer', label: t`Event Page`, iconSrc: navIcon('page'), attention: needsImages},
        {link: 'questions', label: t`Registration Questions`, iconSrc: navIcon('questions')},

        // 5. COMMUNICATION
        {label: t`Communication`},
        {link: 'messages', label: t`Messages`, iconSrc: navIcon('messages'), tileIconSrc: adminIcon('messages-22')},

        // 6. INTEGRATIONS: the super admin's only (the section header too), like on the organizer
        ...(canSeeDeveloperPages ? [
            {label: t`Integrations`},
            {link: 'widget', label: t`Widget Embed`, icon: IconDeviceTabletCode},
            {link: 'webhooks', label: t`Webhooks`, icon: IconWebhook},
        ] : []),
    ];
    const navItemsWithLoading = !isEventSettingsFetched || !isEventFetched
        ? navItems.map(item => item.link ? {...item, loading: true} : item)
        : navItems;

    const breadcrumbItems: BreadcrumbItem[] = isEventFetched ? [
        {
            link: `/manage/organizer/${event?.organizer?.id}`,
            content: event?.organizer?.name
        },
        {
            link: `/manage/event/${event?.id}`,
            content: event?.title
        }
    ] : [
        {link: '#', content: '...'}
    ];

    const handleStatusToggle = () => {
        const isGoingLive = event?.status !== 'LIVE';
        const message = event?.status === 'LIVE'
            ? t`Are you sure you want to make this event draft? This will make the event invisible to the public`
            : t`Are you sure you want to make this event public? This will make the event visible to the public`;

        confirmationDialog(message, () => {
            statusToggleMutation.mutate({
                eventId,
                status: event?.status === 'LIVE' ? 'DRAFT' : 'LIVE'
            }, {
                onSuccess: () => {
                    if (isGoingLive) {
                        openCelebration();
                    } else {
                        showSuccess(t`Event status updated`);
                    }
                },
                onError: (error: any) => {
                    showStatusChangeError(error, t`Event status update failed. Please try again later`);
                }
            });
        });
    };

    const eventPageUrl = `/event/${eventId}/${event?.slug}`;

    // The event card (Figma « Événement actif »): cover, title and date.
    const cover = eventImages?.find((image) => image.type === 'EVENT_COVER');
    const organizerId = event?.organizer?.id ?? event?.organizer_id;
    const organizerName = event?.organizer?.name;

    const navContext: NavContext = {
        initial: event?.title?.trim().charAt(0).toUpperCase() || '…',
        title: isEventFetched ? event?.title : '…',
        subtitle: event ? eventStartLabel(event) : undefined,
        overline: t`Event`,
        imageUrl: cover?.url,
        compact: true,
        backLink: organizerId && organizerName ? {
            to: `/manage/organizer/${organizerId}/events`,
            label: t`${organizerName} · All events`,
        } : undefined,
        menu: event && (
            <>
                {organizerId && <EventSwitcherMenu eventId={eventId as string} organizerId={organizerId}/>}
                <Menu.Item component={NavLink} to={`/manage/organizer/${event.organizer?.id}`}
                           leftSection={<IconArrowLeft size={16}/>}>
                    {t`Organizer Dashboard`}
                </Menu.Item>
                <Menu.Divider/>
                <Menu.Item component="a" href={eventPageUrl} target="_blank" rel="noopener"
                           leftSection={<IconExternalLink size={16}/>}>
                    {t`View event page`}
                </Menu.Item>
                <Menu.Item leftSection={<IconShare size={16}/>} onClick={open}>
                    {t`Share Event`}
                </Menu.Item>
            </>
        ),
    };

    return (
        <>
        <AppLayout
            navItems={navItemsWithLoading}
            breadcrumbItems={breadcrumbItems}
            entityType="event"
            navContext={navContext}
            topBarContent={isEventFetched && (event?.status === 'DRAFT' ? (
                <TopBarButton
                    onClick={handleStatusToggle}
                    size="sm"
                    className={classes.statusButton}
                    title={t`Draft` + ' ' + t`- Click to Publish`}
                    leftSection={<IconEyeOff size={16}/>}
                    rightSection={<IconChevronRight size={14}/>}
                >
                    <span>{t`Draft`} <span className={classes.statusAction}>{t`- Click to Publish`}</span></span>
                </TopBarButton>
            ) : (
                // Live: the eye only, like the preview beside it; the state and the action in the tooltip.
                <Button
                    onClick={handleStatusToggle}
                    variant="outline"
                    leftSection={<IconEye size={20} stroke={2}/>}
                    className={classes.iconButton}
                    title={t`Live` + ' ' + t`- Click to Unpublish`}
                    aria-label={t`Live` + ' ' + t`- Click to Unpublish`}
                />
            ))}
            topBarActions={event && (
                <>
                    <Button
                        component="a"
                        href={eventPageUrl}
                        target="_blank"
                        rel="noopener"
                        variant="outline"
                        leftSection={<IconExternalLink size={20} stroke={2}/>}
                        className={classes.iconButton}
                        title={t`Preview Event page`}
                        aria-label={t`Preview Event page`}
                    />
                    <Button
                        onClick={open}
                        leftSection={<PublicIcon name="partager" size={20}/>}
                        className={classes.shareButton}
                        title={t`Share Event`}
                        aria-label={t`Share Event`}
                    >
                        <span className={classes.longLabel}>{t`Share Event`}</span>
                        <span className={classes.shortLabel}>{t`Share`}</span>
                    </Button>
                </>
            )}
            mobileMenuItems={event ? [{
                link: eventPageUrl,
                external: true,
                // Not « Event Page »: that's the designer now, in the nav.
                label: t`View event page`,
                tileIconSrc: adminIcon('voir-22'),
            }] : []}
            mobileMenuGrouped
            sidebarFooter={
                (me && !me.is_email_verified && !emailConfirmationResent ? (
                    <SidebarCallout
                        icon={<IconMailCheck size={20}/>}
                        heading={t`Verify your email`}
                        description={t`Confirm your email to access all features.`}
                        buttonIcon={<IconMailForward size={16}/>}
                        buttonText={t`Resend email`}
                        onClick={() => handleEmailConfirmationResend()}
                    />
                ) : null)
            }
        />

        {event && (
            <>
                <ShareModal
                    url={eventHomepageUrl(event)}
                    title={event.title}
                    modalTitle={t`Share Event`}
                    opened={opened}
                    onClose={close}
                />

                <EventLiveCelebrationModal
                    opened={celebrationOpened}
                    onClose={closeCelebration}
                    url={eventHomepageUrl(event)}
                    eventTitle={event.title}
                    eventId={String(event.id)}
                />
            </>
        )}
        </>
    );
};

export default EventLayout;
