import {useGetMe} from "../../../queries/useGetMe.ts";
import {useGetOrganizers} from "../../../queries/useGetOrganizers.ts";
import {useGetAccount} from "../../../queries/useGetAccount.ts";
import {useGetEvents} from "../../../queries/useGetEvents.ts";
import {t} from "@lingui/macro";
import {Button, Center, LoadingOverlay, PinInput, Stack, Text} from "@mantine/core";
import classes from "./Onboarding.module.scss";
import {useForm} from "@mantine/form";
import {useDebouncedValue, useMediaQuery} from "@mantine/hooks";
import {Link, NavLink, useNavigate} from "react-router";
import {ReactNode, useEffect, useRef, useState} from "react";
import {useConfirmEmailWithCode} from "../../../mutations/useConfirmEmailWithCode.ts";
import {useResendEmailConfirmation} from "../../../mutations/useResendEmailConfirmation.ts";
import {useCreateOrganizer} from "../../../mutations/useCreateOrganizer.ts";
import {useUpdateAccountEventTypes} from "../../../mutations/useUpdateAccountEventTypes.ts";
import {IconClock} from "@tabler/icons-react";
import {showError, showSuccess} from "../../../utilites/notifications.tsx";
import {trackEvent, AnalyticsEvents} from "../../../utilites/analytics.ts";
import {AccountEventType} from "../../../types.ts";
import {EVENT_TYPES, eventTypeLabel} from "../../../constants/eventTypes.ts";
import {EventTypeIllustration} from "../../common/EventTypeIllustration";

// La carte creme sur l'orange, son logo et la progression en haut.
const OnboardingCard = ({step, children}: { step?: 1 | 2, children: ReactNode }) => {

    return (
        <div className={classes.page}>
            <div className={classes.card} data-rough>
                <div className={classes.topBar}>
                    <Link to={'/'} className={classes.wordmark} aria-label={'Billetterie Dehors'}>
                        <span>BILLETTERIE</span>
                        <span>DEHORS</span>
                    </Link>
                    {step && (
                        <div className={classes.progress}>
                            <span className={classes.progressLong}>{t`Step ${step} of 2`}</span>
                            <span className={classes.progressShort}>{step}/2</span>
                            <span className={classes.segment} data-done/>
                            <span className={classes.segment} data-done={step === 2 || undefined}/>
                        </div>
                    )}
                </div>
                <div className={classes.content}>
                    {children}
                </div>
            </div>
        </div>
    );
};

const ConfirmVerificationPin = () => {
    const {data: userData} = useGetMe();
    const confirmEmailMutation = useConfirmEmailWithCode();
    const resendMutation = useResendEmailConfirmation();
    const [resendCooldown, setResendCooldown] = useState(0);
    const [completedPin, setCompletedPin] = useState('');
    const isMobile = useMediaQuery('(max-width: 768px)');

    const form = useForm({
        initialValues: {
            pin: '',
        },
        validate: {
            pin: (value) => value.length !== 5 ? t`Please enter the 5-digit code` : null,
        }
    });

    // Debounce the completed pin value
    const [debouncedPin] = useDebouncedValue(completedPin, 800);

    // Auto-submit when debounced pin is complete
    useEffect(() => {
        if (debouncedPin.length === 5 && !confirmEmailMutation.isPending) {
            handleSubmit({pin: debouncedPin});
        }
    }, [debouncedPin]);

    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    const handleSubmit = (values: { pin: string }) => {
        confirmEmailMutation.mutate({
                userId: userData?.id || '',
                code: values.pin,
            }, {
                onSuccess: () => {
                    trackEvent(AnalyticsEvents.SIGNUP_COMPLETED);
                    showSuccess(t`Email verified successfully!`);
                    form.reset();
                    setCompletedPin('');
                },
                onError: (error) => {
                    showError(error.response?.data?.message || t`Failed to verify email`);
                    // Clear the pin on error so user can try again
                    form.reset();
                    setCompletedPin('');
                }
            }
        );
    }

    const handleResend = async () => {
        if (!userData?.id) return;

        try {
            await resendMutation.mutateAsync({userId: userData.id});
            showSuccess(t`A new verification code has been sent to your email`);
            setResendCooldown(30);
            form.reset();
        } catch (error: any) {
            if (error?.response?.status === 429) {
                const remainingSeconds = error.response.data?.message?.match(/\d+/)?.[0] || 30;
                setResendCooldown(parseInt(remainingSeconds));
                showError(error.response.data?.message || t`Please wait before requesting another code`);
            } else {
                showError(t`Failed to resend verification code`);
            }
        }
    }

    return (
        <OnboardingCard>
            <h1 className={classes.title}>{t`Check your email`}</h1>
            <p className={classes.subtitle}>{t`We've sent a 5-digit verification code to:`}</p>
            <p className={classes.emailDisplay}>{userData?.email}</p>

            <form className={classes.pinForm} onSubmit={form.onSubmit(handleSubmit)}>
                <Stack gap={24}>
                    <Center>
                        <PinInput
                            {...form.getInputProps('pin')}
                            inputMode={'numeric'}
                            aria-label={t`Verification code`}
                            size={isMobile ? 'md' : 'xl'}
                            length={5}
                            placeholder="•"
                            type="number"
                            disabled={confirmEmailMutation.isPending}
                            error={!!form.errors.pin}
                            className={classes.pinInput}
                            gap={isMobile ? 8 : "sm"}
                            onChange={(value) => {
                                form.setFieldValue('pin', value);
                                setCompletedPin(value.length === 5 ? value : '');
                            }}
                        />
                    </Center>

                    <Button
                        type={'submit'}
                        fullWidth
                        loading={confirmEmailMutation.isPending}
                        className={classes.darkButton}
                    >
                        {confirmEmailMutation.isPending ? t`Verifying...` : t`Verify Email`}
                    </Button>

                    <Stack gap={4} align="center">
                        <Text size="sm" className={classes.help}>
                            {t`Didn't receive the code?`}
                        </Text>
                        <Button
                            variant="subtle"
                            size="sm"
                            onClick={handleResend}
                            disabled={resendCooldown > 0 || resendMutation.isPending}
                            loading={resendMutation.isPending}
                            leftSection={resendCooldown > 0 ? <IconClock size={16}/> : null}
                            className={classes.resend}
                        >
                            {resendCooldown > 0
                                ? t`Resend in ${resendCooldown}s`
                                : t`Resend code`}
                        </Button>
                    </Stack>

                    <Text size="xs" ta="center" className={classes.help}>
                        {t`The code will expire in 10 minutes. Check your spam folder if you don't see the email.`}
                    </Text>
                </Stack>
            </form>
        </OnboardingCard>
    );
}

const EventTypesStep = ({onDone}: { onDone: () => void }) => {
    const {data: me} = useGetMe();
    const {data: account} = useGetAccount();
    const updateEventTypes = useUpdateAccountEventTypes();
    const [selected, setSelected] = useState<AccountEventType[]>(account?.event_types ?? []);

    const toggle = (value: AccountEventType) => setSelected((current) => current.includes(value)
        ? current.filter((type) => type !== value)
        : [...current, value]);

    const handleContinue = () => {
        if (!account?.id || selected.length === 0) {
            onDone();
            return;
        }
        updateEventTypes.mutate({accountId: account.id, eventTypes: selected}, {
            onSuccess: onDone,
            onError: () => showError(t`Something went wrong. Please try again.`),
        });
    };

    return (
        <OnboardingCard step={1}>
            {me?.first_name && <p className={classes.hand}>{t`Welcome, ${me.first_name}!`}</p>}
            <h1 className={classes.title}>{t`What kinds of events do you organize?`}</h1>
            <p className={classes.subtitle}>{t`Pick as many as you like.`}</p>

            <div className={classes.choices}>
                {EVENT_TYPES.map((type) => {
                    const isSelected = selected.includes(type);
                    return (
                        <button
                            key={type}
                            type="button"
                            className={classes.choice} data-rough="button"
                            data-selected={isSelected || undefined}
                            aria-pressed={isSelected}
                            onClick={() => toggle(type)}
                        >
                            <span className={classes.illustration}><EventTypeIllustration type={type}/></span>
                            <span className={classes.choiceLabel}>{eventTypeLabel(type)}</span>
                            {isSelected && (
                                <img src={'/interface/bienvenue/coche.svg'} alt={''} className={classes.check}/>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className={classes.actions}>
                <Button variant="outline" className={classes.outlineButton} onClick={onDone}>
                    {t`Skip this step`}
                </Button>
                <Button className={classes.darkButton} onClick={handleContinue} loading={updateEventTypes.isPending}>
                    {t`Continue`}
                </Button>
            </div>
        </OnboardingCard>
    );
};

const StartStep = ({organizerId}: { organizerId: string | number }) => {
    const organizerPath = `/manage/organizer/${organizerId}`;

    return (
        <OnboardingCard step={2}>
            <p className={classes.hand}>{t`Account created!`}</p>
            <h1 className={classes.title}>{t`Your ticketing is ready!`}</h1>
            <p className={classes.subtitle}>{t`Where to start? The rest can wait.`}</p>

            <div className={classes.options}>
                <div className={classes.option} data-rough data-recommended>
                    <div className={classes.optionTop}>
                        <span className={classes.badge} data-rough>{t`Recommended`}</span>
                        <h2>{t`Create a first event`}</h2>
                        <p>{t`Put free or paid tickets on sale in a few minutes.`}</p>
                    </div>
                    <Button component={NavLink} to={`${organizerPath}/events?create_event=1`} fullWidth
                            className={classes.darkButton}>
                        {t`Create an event`}
                    </Button>
                </div>
                <div className={classes.option} data-rough>
                    <div className={classes.optionTop}>
                        <span className={classes.badge} data-rough>{t`Optional`}</span>
                        <h2>{t`Customize the ticketing`}</h2>
                        <p>{t`Add a logo and colors that match the organization.`}</p>
                    </div>
                    <Button component={NavLink} to={`${organizerPath}/organizer-homepage-designer`} fullWidth
                            variant="outline" className={classes.outlineButton}>
                        {t`Customize`}
                    </Button>
                </div>
                <div className={classes.option} data-rough>
                    <div className={classes.optionTop}>
                        <span className={classes.badge} data-rough>{t`Optional`}</span>
                        <h2>{t`Connect Stripe`}</h2>
                        <p>{t`Receive ticket payments directly in the Stripe account.`}</p>
                    </div>
                    <Button component={NavLink} to={'/account/payment'} fullWidth variant="outline" className={classes.outlineButton}>
                        {t`Connect`}
                    </Button>
                </div>
            </div>

            <Button component={NavLink} to={`${organizerPath}/dashboard`} variant="outline" className={`${classes.outlineButton} ${classes.laterButton}`}
                    rightSection={<img src={'/interface/fleche-suite.svg'} alt={''} className={classes.laterArrow}/>}>
                {t`Later, go to the dashboard`}
            </Button>
        </OnboardingCard>
    );
};

const Welcome = () => {
    const navigate = useNavigate();
    const {data: me} = useGetMe();
    const {data: account} = useGetAccount();
    const organizersQuery = useGetOrganizers();
    const eventsQuery = useGetEvents({pageNumber: 1});
    const createOrganizer = useCreateOrganizer();
    const creatingOrganizer = useRef(false);
    const hasTrackedSignup = useRef(false);
    const [step, setStep] = useState<'types' | 'start'>('types');

    const organizer = organizersQuery.data?.data?.[0];
    const requiresVerification = me
        && me.enforce_email_confirmation_during_registration
        && !me.is_email_verified;

    useEffect(() => {
        if (!me || hasTrackedSignup.current) {
            return;
        }
        // Only track if email verification was NEVER required for this account
        // Users who needed verification are tracked in ConfirmVerificationPin's onSuccess
        if (!me.enforce_email_confirmation_during_registration) {
            hasTrackedSignup.current = true;
            trackEvent(AnalyticsEvents.SIGNUP_COMPLETED);
        }
    }, [me]);

    // Un compte qui a deja des evenements n'a plus rien a faire ici.
    useEffect(() => {
        if (eventsQuery.isFetched && Number(eventsQuery.data?.data?.length) > 0) {
            navigate('/manage/events');
        }
    }, [eventsQuery.isFetched]);

    // L'organisateur se cree tout seul: le nom de l'inscription, le courriel du compte, en CAD.
    useEffect(() => {
        if (requiresVerification || !me || !account || !organizersQuery.isFetched || organizer || creatingOrganizer.current) {
            return;
        }
        creatingOrganizer.current = true;
        createOrganizer.mutate({
            organizerData: {
                name: account.name || me.full_name,
                email: me.email,
                currency: 'CAD',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
        }, {
            onSuccess: () => trackEvent(AnalyticsEvents.ORGANIZER_CREATED),
            onError: () => {
                creatingOrganizer.current = false;
                showError(t`Something went wrong. Please try again.`);
            },
        });
    }, [requiresVerification, me, account, organizersQuery.isFetched, organizer]);

    if (requiresVerification) {
        return <ConfirmVerificationPin/>;
    }

    if (!me || !account || !organizer) {
        return <LoadingOverlay visible/>;
    }

    return step === 'types'
        ? <EventTypesStep onDone={() => setStep('start')}/>
        : <StartStep organizerId={organizer.id as string | number}/>;
}

export default Welcome;
