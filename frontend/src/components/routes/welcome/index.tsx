import {useGetMe} from "../../../queries/useGetMe.ts";
import {useGetOrganizers} from "../../../queries/useGetOrganizers.ts";
import {useGetAccount} from "../../../queries/useGetAccount.ts";
import {useGetEvents} from "../../../queries/useGetEvents.ts";
import {t} from "@lingui/macro";
import {Button, Center, LoadingOverlay, PinInput, Stack, Text, TextInput} from "@mantine/core";
import classes from "./Onboarding.module.scss";
import {useForm} from "@mantine/form";
import {useDebouncedValue, useMediaQuery} from "@mantine/hooks";
import {Link, NavLink, useNavigate} from "react-router";
import {ReactNode, useEffect, useRef, useState} from "react";
import {useConfirmEmailWithCode} from "../../../mutations/useConfirmEmailWithCode.ts";
import {useResendEmailConfirmation} from "../../../mutations/useResendEmailConfirmation.ts";
import {useCreateOrganizer} from "../../../mutations/useCreateOrganizer.ts";
import {useUpdateAccountEventTypes} from "../../../mutations/useUpdateAccountEventTypes.ts";
import {useCreateTaxOrFee} from "../../../mutations/useCreateTaxOrFee.ts";
import {useUpdateOrganizerSettings} from "../../../mutations/useUpdateOrganizerSettings.ts";
import {useGetTaxesAndFees} from "../../../queries/useGetTaxesAndFees.ts";
import {IconClock} from "@tabler/icons-react";
import {showError, showSuccess} from "../../../utilites/notifications.tsx";
import {trackEvent, AnalyticsEvents} from "../../../utilites/analytics.ts";
import {AccountEventType, IdParam, TaxAndFeeCalculationType, TaxAndFeeType} from "../../../types.ts";
import {EVENT_TYPES, eventTypeLabel} from "../../../constants/eventTypes.ts";
import {EventTypeIllustration} from "../../common/EventTypeIllustration";

// La carte creme sur l'orange, son logo et la progression en haut.
const STEPS = 3;

const OnboardingCard = ({step, children}: { step?: 1 | 2 | 3, children: ReactNode }) => {

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
                            <span className={classes.progressLong}>{t`Step ${step} of ${STEPS}`}</span>
                            <span className={classes.progressShort}>{step}/{STEPS}</span>
                            {Array.from({length: STEPS}, (_, index) => (
                                <span key={index} className={classes.segment} data-done={index < step || undefined}/>
                            ))}
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

type TaxAnswer = 'registered' | 'not_registered' | 'unsure';

// Quebec's sales taxes on a ticket: each on the price, QST not on top of GST (since 2013).
const GST_RATE = 5;
const QST_RATE = 9.975;

/**
 * Is the organization registered for GST and QST? Registered: both taxes are created, ticked on every
 * new ticket, and their numbers go on the invoices of new events. Otherwise nothing is charged: a small
 * supplier (under $30,000 a year) doesn't have to register, and can't charge taxes without registering.
 */
const TaxesStep = ({organizerId, onDone}: { organizerId: IdParam, onDone: () => void }) => {
    const [answer, setAnswer] = useState<TaxAnswer | null>(null);
    const [gstNumber, setGstNumber] = useState('');
    const [qstNumber, setQstNumber] = useState('');
    const [saving, setSaving] = useState(false);
    const {data: taxes} = useGetTaxesAndFees();
    const createTax = useCreateTaxOrFee();
    const updateOrganizerSettings = useUpdateOrganizerSettings();

    const choices: { value: TaxAnswer, label: string, hint: string }[] = [
        {value: 'registered', label: t`Yes, both`, hint: t`GST 5% and QST 9.975% will be added to the price of your tickets.`},
        {value: 'not_registered', label: t`No`, hint: t`No taxes: as a small supplier (under $30,000 of sales a year), you don't charge them.`},
        {value: 'unsure', label: t`I don't know`, hint: t`No taxes for now. You can add them at any time in the settings, under Taxes and receipts.`},
    ];

    const createQuebecTaxes = async () => {
        const existing = new Set((taxes?.data ?? []).map(tax => tax.name.trim().toLowerCase()));
        const quebecTaxes = [
            {name: t({message: 'GST', context: 'Canadian goods and services tax'}), rate: GST_RATE, number: gstNumber},
            {name: t({message: 'QST', context: 'Quebec sales tax'}), rate: QST_RATE, number: qstNumber},
        ];
        for (const tax of quebecTaxes) {
            if (existing.has(tax.name.toLowerCase())) {
                continue;
            }
            await createTax.mutateAsync({
                taxOrFeeData: {
                    name: tax.name,
                    rate: tax.rate,
                    type: TaxAndFeeType.Tax,
                    calculation_type: TaxAndFeeCalculationType.Percentage,
                    is_default: true,
                    is_active: true,
                    description: tax.number.trim() || undefined,
                },
            });
        }

        const numbers = quebecTaxes.filter(tax => tax.number.trim()).map(tax => `${tax.name} : ${tax.number.trim()}`);
        if (numbers.length) {
            await updateOrganizerSettings.mutateAsync({
                organizerId,
                organizerSettings: {default_invoice_tax_details: `<p>${numbers.map(escapeHtml).join('<br>')}</p>`},
            });
        }
    };

    const handleContinue = async () => {
        if (answer !== 'registered') {
            onDone();
            return;
        }
        setSaving(true);
        try {
            await createQuebecTaxes();
            onDone();
        } catch {
            showError(t`Something went wrong. Please try again.`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <OnboardingCard step={2}>
            <h1 className={classes.title}>{t`Are you registered for GST and QST?`}</h1>
            <p className={classes.subtitle}>{t`It decides whether taxes are added to the price of your tickets.`}</p>

            <div className={classes.taxChoices} role="radiogroup" aria-label={t`Are you registered for GST and QST?`}>
                {choices.map((choice) => {
                    const isSelected = answer === choice.value;
                    return (
                        <button key={choice.value} type="button" role="radio" aria-checked={isSelected}
                                className={classes.taxChoice} data-rough="button"
                                data-selected={isSelected || undefined}
                                onClick={() => setAnswer(choice.value)}>
                            <span className={classes.choiceLabel}>{choice.label}</span>
                            <span className={classes.taxHint}>{choice.hint}</span>
                            {isSelected && <img src={'/interface/bienvenue/coche.svg'} alt={''} className={classes.check}/>}
                        </button>
                    );
                })}
            </div>

            {answer === 'registered' && (
                <div className={classes.taxNumbers}>
                    <TextInput label={t`GST number`} placeholder="123456789 RT0001" value={gstNumber}
                               onChange={(e) => setGstNumber(e.currentTarget.value)} maxLength={30}/>
                    <TextInput label={t`QST number`} placeholder="1234567890 TQ0001" value={qstNumber}
                               onChange={(e) => setQstNumber(e.currentTarget.value)} maxLength={30}/>
                    <p className={classes.taxNumbersHint}>
                        {t`Shown on your invoices and receipts. You can add them later.`}
                    </p>
                </div>
            )}

            <div className={classes.actions}>
                <Button variant="outline" className={classes.outlineButton} onClick={onDone}>
                    {t`Skip this step`}
                </Button>
                <Button className={classes.darkButton} onClick={handleContinue} loading={saving} disabled={!answer}>
                    {t`Continue`}
                </Button>
            </div>
        </OnboardingCard>
    );
};

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c] as string);

const StartStep = ({organizerId}: { organizerId: string | number }) => {
    const organizerPath = `/manage/organizer/${organizerId}`;

    return (
        <OnboardingCard step={3}>
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
    const [step, setStep] = useState<'types' | 'taxes' | 'start'>('types');

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

    if (step === 'types') {
        return <EventTypesStep onDone={() => setStep('taxes')}/>;
    }
    if (step === 'taxes') {
        return <TaxesStep organizerId={organizer.id as IdParam} onDone={() => setStep('start')}/>;
    }
    return <StartStep organizerId={organizer.id as string | number}/>;
}

export default Welcome;
