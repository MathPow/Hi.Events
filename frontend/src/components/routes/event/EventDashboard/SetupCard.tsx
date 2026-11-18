import {ReactNode, useEffect, useState} from "react";
import {NavLink} from "react-router";
import {plural, t} from "@lingui/macro";
import {UnstyledButton} from "@mantine/core";
import {Event, IdParam} from "../../../../types.ts";
import {useGetEventImages} from "../../../../queries/useGetEventImages.ts";
import {useGetAccount} from "../../../../queries/useGetAccount.ts";
import {useUpdateEventStatus} from "../../../../mutations/useUpdateEventStatus.ts";
import {getProductsFromEvent} from "../../../../utilites/helpers.ts";
import {confirmationDialog} from "../../../../utilites/confirmationDialog.tsx";
import {showSuccess} from "../../../../utilites/notifications.tsx";
import {trackEvent, AnalyticsEvents} from "../../../../utilites/analytics.ts";
import {showStatusChangeError} from "../../../common/EmailNotConfirmedError";
import {SkeletonLine} from "../../../common/Skeletons";
import classes from "./EventDashboard.module.scss";

const icon = (name: string) => `/interface/admin/tableau/${name}.svg`;

const DISMISSED_KEY = (eventId: IdParam) => 'setupChecklistDismissed-' + eventId;

interface Step {
    key: string;
    done: boolean;
    title: string;
    description: string;
    action: ReactNode;
}

const StepLink = ({to, children}: { to: string, children: ReactNode }) => (
    <NavLink to={to} className={classes.stepAction}>
        {children}
        <img src={icon('fleche-petite')} alt=""/>
    </NavLink>
);

/**
 * « Préparez votre événement » (formerly the « Commencer » page): the four steps before selling, each
 * with its action. Gone once everything is done, or when the organizer closes it.
 */
export const SetupCard = ({eventId, event}: { eventId: IdParam, event: Event }) => {
    const {data: images, isFetched: imagesFetched} = useGetEventImages(eventId);
    const {data: account, isFetched: accountFetched} = useGetAccount();
    const statusMutation = useUpdateEventStatus();
    const [dismissed, setDismissed] = useState(true);

    useEffect(() => {
        try {
            setDismissed(localStorage.getItem(DISMISSED_KEY(eventId)) === 'true');
        } catch {
            setDismissed(false);
        }
    }, [eventId]);

    const dismiss = () => {
        setDismissed(true);
        try {
            localStorage.setItem(DISMISSED_KEY(eventId), 'true');
        } catch {
            // localStorage unavailable
        }
    };

    const publish = () => confirmationDialog(
        t`Are you sure you want to make this event public? This will make the event visible to the public`,
        () => statusMutation.mutate({eventId, status: 'LIVE'}, {
            onSuccess: () => {
                trackEvent(AnalyticsEvents.EVENT_PUBLISHED);
                showSuccess(t`Event status updated`);
            },
            onError: (error: any) => showStatusChangeError(error, t`Event status update failed. Please try again later`, {
                eventId,
                organizerId: event.organizer?.id ?? event.organizer_id,
            }),
        }),
    );

    const organizerId = event.organizer?.id ?? event.organizer_id;
    const steps: Step[] = [
        {
            key: 'ticket',
            done: !!getProductsFromEvent(event)?.length,
            title: t`Add a ticket`,
            description: t`At least one ticket on sale.`,
            action: <StepLink to={`/manage/event/${eventId}/products#create-product`}>{t`Add`}</StepLink>,
        },
        {
            key: 'page',
            done: !!images?.length && !!event.description,
            title: t({message: 'Customize the page', context: 'getting started action'}),
            description: t`Image, description and color.`,
            action: <StepLink to={`/manage/event/${eventId}/homepage-designer`}>{t`Customize`}</StepLink>,
        },
        {
            key: 'stripe',
            done: !!account?.stripe_connect_setup_complete,
            title: t`Connect Stripe`,
            description: t`To receive your payments.`,
            action: <StepLink to={`/manage/organizer/${organizerId}/settings/payments`}>{t`Connect`}</StepLink>,
        },
        {
            key: 'publish',
            done: event.status === 'LIVE',
            title: t`Publish Event`,
            description: t`Make it visible to the public.`,
            action: (
                <UnstyledButton className={classes.stepAction} onClick={publish} disabled={statusMutation.isPending}>
                    {t`Publish`}
                    <img src={icon('fleche-petite')} alt=""/>
                </UnstyledButton>
            ),
        },
    ];

    const doneCount = steps.filter((step) => step.done).length;
    const total = steps.length;

    if (dismissed || !imagesFetched || !accountFetched || doneCount === total) {
        return null;
    }

    return (
        <section className={`${classes.card} ${classes.setupCard}`}>
            <div className={classes.setupHead}>
                <div className={classes.setupHeadText}>
                    <h2 className={classes.setupTitle}>{t`Get your event ready`}</h2>
                    <span className={classes.setupCount}>
                        {plural(doneCount, {one: `# step out of ${total}`, other: `# steps out of ${total}`})}
                    </span>
                </div>
                <UnstyledButton className={classes.closeButton} onClick={dismiss} aria-label={t`Hide`} title={t`Hide`}>
                    <img src={icon('fermer')} alt=""/>
                </UnstyledButton>
            </div>

            <span className={classes.setupBar} role="progressbar" aria-valuemin={0} aria-valuemax={total}
                  aria-valuenow={doneCount}>
                <span style={{width: `${doneCount / total * 100}%`}}/>
            </span>

            <ol className={classes.steps}>
                {steps.map((step, index) => (
                    <li key={step.key} className={classes.step} data-done={step.done || undefined}>
                        <span className={classes.stepPastille}>
                            {step.done ? <img src={icon('coche-blanche')} alt=""/> : index + 1}
                        </span>
                        <span className={classes.stepTitle}>{step.title}</span>
                        <span className={classes.stepDescription}>{step.description}</span>
                        {step.done ? <span className={classes.stepDone}>{t`Done`}</span> : step.action}
                    </li>
                ))}
            </ol>
        </section>
    );
};

// « Préparez votre événement » while the event loads: the four steps, their state still unknown.
export const SetupCardSkeleton = () => {
    const steps = [
        [t`Add a ticket`, t`At least one ticket on sale.`],
        [t({message: 'Customize the page', context: 'getting started action'}), t`Image, description and color.`],
        [t`Connect Stripe`, t`To receive your payments.`],
        [t`Publish Event`, t`Make it visible to the public.`],
    ];

    return (
        <section className={`${classes.card} ${classes.setupCard}`} aria-busy>
            <div className={classes.setupHead}>
                <div className={classes.setupHeadText}>
                    <h2 className={classes.setupTitle}>{t`Get your event ready`}</h2>
                    <SkeletonLine width={90} height={16}/>
                </div>
            </div>
            <span className={classes.setupBar}><span style={{width: 0}}/></span>
            <ol className={classes.steps}>
                {steps.map(([title, description], index) => (
                    <li key={index} className={classes.step}>
                        <span className={classes.stepPastille}>{index + 1}</span>
                        <span className={classes.stepTitle}>{title}</span>
                        <span className={classes.stepDescription}>{description}</span>
                        <span className={classes.stepAction}><SkeletonLine width={84} height={18}/></span>
                    </li>
                ))}
            </ol>
        </section>
    );
};
