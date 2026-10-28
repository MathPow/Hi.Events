import {Alert, Button, Checkbox, LoadingOverlay, PasswordInput, Text, TextInput} from "@mantine/core";
import {hasLength, isEmail, matchesField, useForm} from "@mantine/form";
import {RegisterAccountRequest} from "../../../../types.ts";
import {useFormErrorResponseHandler} from "../../../../hooks/useFormErrorResponseHandler.tsx";
import {useRegisterAccount} from "../../../../mutations/useRegisterAccount.ts";
import {NavLink, useLocation, useNavigate} from "react-router";
import {t, Trans} from "@lingui/macro";
import classes from "./Register.module.scss";
import {getClientLocale} from "../../../../locales.ts";
import {useEffect, useState} from "react";
import {getConfig} from "../../../../utilites/config.ts";
import {captureUtmData, getStoredUtmData, clearStoredUtmData} from "../../../../utilites/utm.ts";
import {useGetRegistrationInvite} from "../../../../queries/useGetRegistrationInvite.ts";
import {IconAlertCircle} from "@tabler/icons-react";
import {Turnstile} from "../../../common/Turnstile";

export const Register = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Quand l'inscription publique est fermee, seule une invitation ouvre le
    // formulaire. On la valide avant d'afficher quoi que ce soit, pour ne pas
    // faire remplir un formulaire qui sera refuse.
    const registrationToken = new URLSearchParams(location.search).get('registration_token');
    const inviteQuery = useGetRegistrationInvite(registrationToken);
    const invitedEmail = inviteQuery.data?.data?.email ?? null;
    const turnstileSiteKey = getConfig('VITE_TURNSTILE_SITE_KEY');
    const [turnstileResetKey, setTurnstileResetKey] = useState(0);

    const form = useForm({
        validateInputOnBlur: true,
        initialValues: {
            organization_name: '',
            full_name: '',
            email: '',
            password: '',
            password_confirmation: '',
            timezone: typeof window !== 'undefined'
                ? Intl.DateTimeFormat().resolvedOptions().timeZone
                : 'UTC',
            locale: getClientLocale(),
            invite_token: '',
            registration_token: registrationToken ?? '',
            currency_code: 'CAD',
            marketing_opt_in: false,
            turnstile_token: '',
        },
        validate: {
            password: hasLength({min: 8}, t`Password must be at least 8 characters`),
            password_confirmation: matchesField('password', t`Passwords are not the same`),
            email: isEmail(t`Please check your email is valid`),
            organization_name: (value) => value.trim() === '' ? t`Organization name is required` : null,
            full_name: (value) => value.trim() === '' ? t`Full name is required` : null,
        },
    });
    const errorHandler = useFormErrorResponseHandler();
    const mutate = useRegisterAccount();

    const registerUser = ({full_name, ...values}: typeof form.values) => {
        // Un seul champ « Nom complet »: le prenom avant le premier espace, le nom apres.
        const [firstName, ...lastNames] = full_name.trim().split(/\s+/);
        const data = {
            ...values,
            first_name: firstName,
            last_name: lastNames.join(' '),
        } as RegisterAccountRequest;
        const utmData = getStoredUtmData();
        const registrationData = utmData ? {...data, ...utmData} : data;

        mutate.mutate({registerData: registrationData}, {
            onSuccess: () => {
                clearStoredUtmData();
                navigate(`/welcome${location.search}`);
            },
            onError: (error: any) => {
                errorHandler(form, error, error.response?.data?.message);
                // Le jeton a ete consomme par la verification: il en faut un nouveau.
                setTurnstileResetKey((key) => key + 1);
            },
        });
    }

    useEffect(() => {
        if (invitedEmail) {
            form.setFieldValue('email', invitedEmail);
        }
    }, [invitedEmail]);

    useEffect(() => {
        captureUtmData();

        const searchParams = new URLSearchParams(location.search);
        const token = searchParams.get('invite_token');

        if (token) {
            form.setFieldValue('invite_token', token);
        }
    }, [location.search]);

    if (registrationToken && inviteQuery.isLoading) {
        return <LoadingOverlay visible/>;
    }

    if (registrationToken && inviteQuery.isError) {
        return (
            <>
                <header className={classes.header}>
                    <h2>{t`Invitation unavailable`}</h2>
                </header>
                <div className={classes.registerCard}>
                    <Alert icon={<IconAlertCircle size={16}/>} color="red">
                        {(inviteQuery.error as any)?.response?.data?.message
                            || t`This invitation link is no longer valid. Ask for a new one.`}
                    </Alert>
                </div>
            </>
        );
    }

    return (
        <div className={classes.stack}>
            <header className={classes.header}>
                <h2>{t`Create an account`}</h2>
                <p>
                    <Trans>
                        Already have an account?{' '}
                        <NavLink to={`/auth/login${location.search}`}>
                            {t`Log in`}
                        </NavLink>
                    </Trans>
                </p>
            </header>

            <form className={classes.registerForm} onSubmit={form.onSubmit(registerUser)}>
                <TextInput
                    {...form.getInputProps('organization_name')}
                    label={t`Organization Name`}
                    description={t`The name your buyers will see. You can change it later.`}
                    inputWrapperOrder={['label', 'input', 'description', 'error']}
                    placeholder={'DehorsQC'}
                    required
                />

                <TextInput
                    {...form.getInputProps('full_name')}
                    label={t`Full name`}
                    placeholder={'Mathys Deshaies'}
                    autoComplete="name"
                    required
                />

                <TextInput
                    {...form.getInputProps('email')}
                    label={t`Email`}
                    placeholder={t`name@example.com`}
                    description={invitedEmail ? t`This invitation is tied to this address.` : undefined}
                    inputWrapperOrder={['label', 'input', 'description', 'error']}
                    readOnly={!!invitedEmail}
                    type="email"
                    required
                />

                {/* Cote a cote sur ordi, l'un sous l'autre sur mobile, l'indice entre les deux. */}
                <div className={classes.passwords}>
                    <PasswordInput
                        {...form.getInputProps('password')}
                        className={classes.password}
                        label={t`Password`}
                        placeholder={'••••••••'}
                        visibilityToggleIcon={() => <img src={'/interface/oeil.svg'} alt={''}/>}
                        required
                    />
                    <PasswordInput
                        {...form.getInputProps('password_confirmation')}
                        className={classes.confirmation}
                        label={<>
                            <span className={classes.labelShort}>{t`Confirmation`}</span>
                            <span className={classes.labelLong}>{t`Confirm Password`}</span>
                        </>}
                        placeholder={'••••••••'}
                        visibilityToggleIcon={() => <img src={'/interface/oeil.svg'} alt={''}/>}
                        required
                    />
                    <p className={classes.hint}>{t`Minimum 8 characters.`}</p>
                </div>

                <TextInput
                    style={{display: 'none'}}
                    {...form.getInputProps('timezone')}
                    type="hidden"
                />

                <Checkbox
                    {...form.getInputProps('marketing_opt_in', {type: 'checkbox'})}
                    className={classes.checkbox}
                    label={t`Receive news from the ticketing platform`}
                />

                {turnstileSiteKey && (
                    <div className={classes.turnstile}>
                        <Turnstile
                            siteKey={turnstileSiteKey}
                            resetKey={turnstileResetKey}
                            onToken={(token) => form.setFieldValue('turnstile_token', token)}
                        />
                        {form.errors.turnstile_token && (
                            <Text c="red" size="xs" mt={4}>{form.errors.turnstile_token}</Text>
                        )}
                    </div>
                )}

                <Button
                    type="submit"
                    fullWidth
                    disabled={mutate.isPending || (!!turnstileSiteKey && !form.values.turnstile_token)}
                >
                    {mutate.isPending ? t`Working...` : t`Create my account`}
                </Button>

                <footer className={classes.terms}>
                    <Trans>
                        By registering you agree to our <NavLink target={'_blank'}
                                                                 to={getConfig("VITE_TOS_URL", "https://hi.events/terms-of-service?utm_source=app-register-footer") as string}>Terms
                        of Service</NavLink> and <NavLink
                        target={'_blank'}
                        to={getConfig("VITE_PRIVACY_URL", 'https://hi.events/privacy-policy?utm_source=app-register-footer') as string}>Privacy Policy</NavLink>.
                    </Trans>
                </footer>
            </form>
        </div>
    )
}

export default Register;
