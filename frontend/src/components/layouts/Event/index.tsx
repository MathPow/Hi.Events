import {
    IconArrowLeft,
    IconChevronRight,
    IconDeviceTabletCode,
    IconDiscount2,
    IconExternalLink,
    IconEye,
    IconEyeOff,
    IconMailCheck,
    IconMailForward,
    IconPaint,
    IconQrcode,
    IconReceipt,
    IconShare,
    IconStar,
    IconTicket,
    IconTrendingUp,
    IconUserQuestion,
    IconUsers,
    IconUsersGroup,
    IconWebhook,
    IconListCheck,
    IconShieldLock,
} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import {getProductsFromEvent} from "../../../utilites/helpers.ts";
import {useGetEvent} from "../../../queries/useGetEvent";
import {useGetEventSettings} from "../../../queries/useGetEventSettings";
import {useGetEventStats} from "../../../queries/useGetEventStats";
import {useGetEventImages} from "../../../queries/useGetEventImages.ts";
import {useGetAccount} from "../../../queries/useGetAccount.ts";
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

const EventLayout = () => {
    const location = useLocation();
    const {eventId} = useParams();

    const [opened, {open, close}] = useDisclosure(false);
    const [celebrationOpened, {open: openCelebration, close: closeCelebration}] = useDisclosure(false);

    const statusToggleMutation = useUpdateEventStatus();

    const {data: event, isFetched: isEventFetched} = useGetEvent(eventId);
    const {data: eventSettings, isFetched: isEventSettingsFetched} = useGetEventSettings(eventId);
    const {data: eventStats} = useGetEventStats(eventId);
    const {data: eventImages, isFetched: isEventImagesFetched} = useGetEventImages(eventId);
    const {data: account, isFetched: isAccountFetched} = useGetAccount();
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

    // Same steps as the Getting Started page: point to the pages that still need work.
    const isSetupStatusKnown = isEventFetched && isEventImagesFetched && isAccountFetched;
    const needsProducts = isSetupStatusKnown && !products?.length;
    const needsDetails = isSetupStatusKnown && !event?.description;
    const needsImages = isSetupStatusKnown && !eventImages?.length;
    const remainingSetupSteps = isSetupStatusKnown ? [
        needsProducts,
        needsDetails,
        !account?.stripe_connect_setup_complete,
        needsImages,
        event?.status !== 'LIVE',
    ].filter(Boolean).length : 0;

    const navItems: NavItem[] = [
        {link: '/manage/organizer/' + event?.organizer?.id, label: t`Organizer Dashboard`, icon: IconArrowLeft},

        // 1. OVERVIEW
        {label: t`Overview`},
        {
            link: 'getting-started',
            label: t`Getting Started`,
            icon: IconStar,
            showWhen: () => !eventSettings?.hide_getting_started_page,
            badge: remainingSetupSteps > 0 ? remainingSetupSteps : undefined,
            attention: remainingSetupSteps > 0,
        },
        {link: 'dashboard', label: t`Dashboard`, iconSrc: adminIcon('accueil'), mobileTab: true, mobileTabLabel: t`Overview`},
        {
            link: 'reports',
            label: t`Reports`,
            iconSrc: adminIcon('rapports'),
            isActive: (isActive) => isActive || location.pathname.includes('/report/')
        },

        // 2. EVENT SETUP
        {label: t`Setup & Design`},
        {
            link: 'settings',
            label: t`Event Settings`,
            crumbLabel: t`Settings`,
            iconSrc: adminIcon('parametres'),
            tileIconSrc: adminIcon('parametres-22'),
            attention: needsDetails,
        },
        {link: 'homepage-designer', label: t`Homepage Designer`, icon: IconPaint, attention: needsImages},
        {link: 'ticket-designer', label: t`Ticket Designer`, icon: IconTicket},
        {link: 'questions', label: t`Registration Questions`, icon: IconUserQuestion},

        // 3. Ticketing & Sales
        {label: t`Ticketing & Sales`},
        {link: 'products', label: t`Tickets & Products`, icon: IconTicket, attention: needsProducts},
        {link: 'orders', label: t`Orders`, icon: IconReceipt, badge: eventStats?.total_orders, mobileTab: true},
        ...(hasDeposits ? [{link: 'deposits', label: t`Deposits`, icon: IconShieldLock}] : []),
        {link: 'promo-codes', label: t`Promo Codes`, icon: IconDiscount2},
        {link: 'affiliates', label: t`Affiliates`, icon: IconTrendingUp},

        // 4. GUESTS
        {label: t`Guest Management`},
        {link: 'attendees', label: t`Attendees`, icon: IconUsers, badge: eventStats?.total_attendees_registered, mobileTab: true},
        {link: 'check-in', label: t`Check-In Lists`, icon: IconQrcode, mobileTab: true, mobileTabLabel: t`Check-in`},
        {link: 'messages', label: t`Messages`, iconSrc: adminIcon('messages'), tileIconSrc: adminIcon('messages-22')},
        {link: 'sold-out-waitlist', label: t`Waitlist`, icon: IconListCheck},
        {link: 'capacity-assignments', label: t`Capacity Management`, icon: IconUsersGroup},

        // 5. INTEGRATIONS
        {label: t`Integrations`},
        {link: 'widget', label: t`Widget Embed`, icon: IconDeviceTabletCode},
        ...(canSeeDeveloperPages ? [{link: 'webhooks', label: t`Webhooks`, icon: IconWebhook}] : []),


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

    const navContext: NavContext = {
        initial: event?.title?.trim().charAt(0).toUpperCase() || '…',
        title: isEventFetched ? event?.title : '…',
        subtitle: event?.organizer?.name,
        menu: event && (
            <>
                <Menu.Item component={NavLink} to={`/manage/organizer/${event.organizer?.id}`}
                           leftSection={<IconArrowLeft size={16}/>}>
                    {t`Organizer Dashboard`}
                </Menu.Item>
                <Menu.Divider/>
                <Menu.Item component="a" href={eventPageUrl} target="_blank" rel="noopener"
                           leftSection={<IconExternalLink size={16}/>}>
                    {t`Event Page`}
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
            topBarContent={isEventFetched && (
                <TopBarButton
                    onClick={handleStatusToggle}
                    size="sm"
                    className={classes.statusButton}
                    title={event?.status === 'DRAFT' ? t`Draft` + ' ' + t`- Click to Publish` : t`Live` + ' ' + t`- Click to Unpublish`}
                    leftSection={event?.status === 'DRAFT' ? <IconEyeOff size={16}/> : <IconEye size={16}/>}
                    rightSection={<IconChevronRight size={14}/>}
                >
                    {event?.status === 'DRAFT'
                        ? <span>{t`Draft`} <span
                            className={classes.statusAction}>{t`- Click to Publish`}</span></span>
                        : <span>{t`Live`} <span
                            className={classes.statusAction}>{t`- Click to Unpublish`}</span></span>
                    }
                </TopBarButton>
            )}
            topBarActions={event && (
                <>
                    <Button
                        component="a"
                        href={eventPageUrl}
                        target="_blank"
                        rel="noopener"
                        variant="outline"
                        leftSection={<IconExternalLink size={20} stroke={2}/>}
                        className={classes.previewButton}
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
                label: t`Event Page`,
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
