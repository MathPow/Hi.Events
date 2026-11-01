import {t} from "@lingui/macro"
import {Button} from "@mantine/core";
import classes from "./GettingStarted.module.scss";
import {NavLink, useLocation, useNavigate, useParams} from "react-router";
import {useGetEvent} from "../../../../queries/useGetEvent.ts";
import {useGetEventImages} from "../../../../queries/useGetEventImages.ts";
import {useGetAccount} from "../../../../queries/useGetAccount.ts";
import {useUpdateEventStatus} from "../../../../mutations/useUpdateEventStatus.ts";
import {showSuccess} from "../../../../utilites/notifications.tsx";
import {getProductsFromEvent} from "../../../../utilites/helpers.ts";
import {ReactNode, useEffect, useState} from 'react';
import ConfettiAnimation from "./ConfettiAnimaiton";
import {Browser, useBrowser} from "../../../../hooks/useGetBrowser.ts";
import {trackEvent, AnalyticsEvents} from "../../../../utilites/analytics.ts";
import {showStatusChangeError} from "../../../common/EmailNotConfirmedError";
import {PublicIcon, PublicIconName} from "../../../common/PublicIcon";
import {StatusTag} from "../../../common/StatusTag";

interface Step {
    key: string;
    icon: PublicIconName;
    done: boolean;
    title: string;
    description: string;
    action: (isNext: boolean) => ReactNode;
}

/**
 * « Préparez votre événement »: the steps before selling tickets (the same ones the sidebar counts
 * on « Commencer »), each with its page, in the look of the organizer pages.
 */
const GettingStarted = () => {
    const {eventId} = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [showConfetti, setShowConfetti] = useState(false);
    const browser = useBrowser();

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const isChromeOrFirefox = browser === Browser.Chrome || browser === Browser.Firefox;

        if (searchParams.get('new_event') === 'true' && isChromeOrFirefox) {
            setShowConfetti(true);

            setTimeout(() => {
                searchParams.delete('new_event');
                navigate({
                    pathname: location.pathname,
                    search: searchParams.toString()
                }, {replace: true});
            }, 2000);
        }
    }, [location, navigate]);

    const eventQuery = useGetEvent(eventId);
    const event = eventQuery.data;
    const products = getProductsFromEvent(event);
    const hasProducts = !!products && products.length > 0;
    const eventImagesQuery = useGetEventImages(eventId);
    const eventImages = eventImagesQuery.data;
    const hasImages = !!eventImages && eventImages.length > 0;
    const accountQuery = useGetAccount();
    const account = accountQuery.data;
    const statusToggleMutation = useUpdateEventStatus();
    const isLive = event?.status === 'LIVE';

    const handleStatusToggle = () => {
        const newStatus = event?.status === 'LIVE' ? 'DRAFT' : 'LIVE';
        statusToggleMutation.mutate({
            eventId,
            status: newStatus
        }, {
            onSuccess: () => {
                if (newStatus === 'LIVE') {
                    trackEvent(AnalyticsEvents.EVENT_PUBLISHED);
                }
                showSuccess(t`Event status updated`);
            },
            onError: (error: any) => {
                showStatusChangeError(error, t`Event status update failed. Please try again later`);
            }
        });
    }

    const buttonClass = (isNext: boolean) => isNext ? classes.primaryButton : classes.outlineButton;

    const steps: Step[] = [
        {
            key: 'tickets',
            icon: 'billet',
            done: hasProducts,
            title: t({message: 'Add tickets', context: 'getting started step'}),
            description: t`Create tickets for your event, set prices, and manage available quantity.`,
            action: (isNext) => (
                <Button component={NavLink} className={buttonClass(isNext)}
                        to={'/manage/event/' + eventId + '/products#create-product'}>
                    {hasProducts ? t`Add More tickets` : t`Add tickets`}
                </Button>
            ),
        },
        {
            key: 'details',
            icon: 'modifier',
            done: !!event?.description,
            title: t({message: 'Set up your event', context: 'getting started step'}),
            description: t`Add event details and manage event settings.`,
            action: (isNext) => (
                <Button component={NavLink} className={buttonClass(isNext)}
                        to={'/manage/event/' + eventId + '/settings'}>
                    {event?.description
                        ? t`Continue set up`
                        : t({message: 'Set up your event', context: 'getting started action'})}
                </Button>
            ),
        },
        {
            key: 'stripe',
            icon: 'cadenas',
            done: !!account?.stripe_connect_setup_complete,
            title: t({message: 'Connect with Stripe', context: 'getting started step'}),
            description: t`Connect your Stripe account to start receiving payments.`,
            action: (isNext) => !account?.stripe_connect_setup_complete && (
                <Button component={NavLink} className={buttonClass(isNext)} to={'/account/payment'}>
                    {t`Connect Stripe`}
                </Button>
            ),
        },
        {
            key: 'page',
            icon: 'etoile',
            done: hasImages,
            title: t({message: 'Customize your event page', context: 'getting started step'}),
            description: t`Customize your event page to match your brand and style.`,
            action: (isNext) => (
                <Button component={NavLink} className={buttonClass(isNext)}
                        to={'/manage/event/' + eventId + '/homepage-designer'}>
                    {t({message: 'Customize the page', context: 'getting started action'})}
                </Button>
            ),
        },
        {
            key: 'live',
            icon: 'globe',
            done: isLive,
            title: t({message: 'Set your event live', context: 'getting started step'}),
            description: t`Once you're ready, set your event live and start selling products.`,
            action: (isNext) => !isLive && (
                <Button className={buttonClass(isNext)} onClick={handleStatusToggle}
                        loading={statusToggleMutation.isPending}>
                    {t`Publish Event`}
                </Button>
            ),
        },
    ];

    const isLoaded = !!event && !!account && eventImagesQuery.isFetched;
    const doneCount = steps.filter((step) => step.done).length;
    const total = steps.length;
    const nextStep = steps.find((step) => !step.done);

    return (
        <>
            {showConfetti && <ConfettiAnimation duration={2000}/>}
            <div className={classes.page}>
                <header className={classes.header}>
                    <h1 className={classes.title}>{t`Get your event ready`}</h1>
                    <p className={classes.subtitle}>
                        {t`Complete these steps to start selling tickets for your event.`}
                    </p>
                </header>

                <section className={classes.progressCard} aria-busy={!isLoaded}>
                    <span className={classes.progressCount}>
                        {isLoaded ? `${doneCount}/${total}` : '…'}
                    </span>
                    <div className={classes.progressText}>
                        <h2>
                            {isLoaded && doneCount === total
                                ? t`Everything is ready, your tickets are on sale.`
                                : t`Congratulations on creating an event!`}
                        </h2>
                        <span className={classes.progressBar}
                              role="progressbar"
                              aria-valuemin={0}
                              aria-valuemax={total}
                              aria-valuenow={doneCount}
                              aria-label={t`${doneCount} of ${total} steps completed`}>
                            <span style={{width: `${isLoaded ? doneCount / total * 100 : 0}%`}}/>
                        </span>
                        <span className={classes.progressLabel}>{t`${doneCount} of ${total} steps completed`}</span>
                    </div>
                </section>

                <ol className={classes.steps}>
                    {steps.map((step, index) => {
                        const isNext = isLoaded && step.key === nextStep?.key;
                        const action = step.action(isNext);

                        return (
                            <li key={step.key} className={classes.step} data-done={(isLoaded && step.done) || undefined}
                                data-next={isNext || undefined}>
                                <div className={classes.stepTop}>
                                    <span className={classes.stepPastille}>
                                        {isLoaded && step.done
                                            ? <PublicIcon name="coche" size={20}/>
                                            : <PublicIcon name={step.icon} size={20}/>}
                                    </span>
                                    <span className={classes.stepNumber}>
                                        {t`Step ${index + 1}`}
                                    </span>
                                    {isLoaded && (step.done
                                        ? <StatusTag tone="ok">{t`Done`}</StatusTag>
                                        : <StatusTag tone={isNext ? 'waiting' : 'neutral'}>
                                            {t({message: 'To do', context: 'getting started step'})}
                                        </StatusTag>)}
                                </div>
                                <h2 className={classes.stepTitle}>{step.title}</h2>
                                <p className={classes.stepDescription}>{step.description}</p>
                                {action && <div className={classes.stepAction}>{action}</div>}
                            </li>
                        );
                    })}
                </ol>
            </div>
        </>
    );
}

export default GettingStarted;
