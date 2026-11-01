import {useForm, UseFormReturnType} from "@mantine/form";
import {Button, PasswordInput, Select, TextInput} from "@mantine/core";
import {useEffect, useRef, useState} from "react";
import {useSearchParams} from "react-router";
import {t, Trans} from "@lingui/macro";
import {useGetMe} from "../../../../queries/useGetMe.ts";
import {timezones} from "../../../../../data/timezones.ts";
import {useUpdateMe} from "../../../../mutations/useUpdateMe.ts";
import {showError, showSuccess} from "../../../../utilites/notifications.tsx";
import {UserMeRequest} from "../../../../api/user.client.ts";
import {useCancelEmailChange} from "../../../../mutations/useCancelEmailChange.ts";
import {useFormErrorResponseHandler} from "../../../../hooks/useFormErrorResponseHandler.tsx";
import {useResendEmailConfirmation} from "../../../../mutations/useResendEmailConfirmation.ts";
import {useConfirmEmailAddress} from "../../../../mutations/useConfirmEmailAddress.ts";
import {useConfirmEmailChange} from "../../../../mutations/useConfirmEmailChange.ts";
import {availableLocales, localeToFlagEmojiMap, localeToNameMap, SupportedLocales} from "../../../../locales.ts";
import {getConfig} from "../../../../utilites/config.ts";
import {usePageDetail} from "../../../layouts/AppLayout/PageStatus.tsx";
import {Modal} from "../../../common/Modal";
import {SettingsCard, ToggleRow} from "../../organizer/Settings/SettingsUi.tsx";
import settings from "../../organizer/Settings/Settings.module.scss";
import classes from "./ManageProfile.module.scss";

const localeSelectData = availableLocales.map(locale => ({
    value: locale,
    label: `${localeToFlagEmojiMap[locale as SupportedLocales]} ${localeToNameMap[locale as SupportedLocales]}`,
}));

/**
 * « My profile », in the organizer's space like « Settings » (/manage/organizer/<id>/profile): the
 * person's details, language and region, and password. The links of the emails come here too:
 * ?confirm-email= confirms the address, ?confirm-email-change= asks to confirm the new one in a popup.
 */
export const ManageProfile = () => {
    const {data: me, isFetching, isFetched} = useGetMe();
    const mutation = useUpdateMe();
    const cancelEmailChangeMutation = useCancelEmailChange();
    const resendEmailConfirmationMutation = useResendEmailConfirmation();
    const confirmEmailAddress = useConfirmEmailAddress();
    const confirmEmailChange = useConfirmEmailChange();
    const errorHandler = useFormErrorResponseHandler();
    const [emailConfirmationResent, setEmailConfirmationResent] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const confirmEmailToken = searchParams.get('confirm-email');
    const emailChangeToken = searchParams.get('confirm-email-change');
    const confirmedToken = useRef<string | null>(null);
    // eslint-disable-next-line lingui/no-unlocalized-strings
    const appName = getConfig("VITE_APP_NAME", "Hi.Events");

    usePageDetail(t`My Profile`);

    const profileForm = useForm({
        initialValues: {
            first_name: me?.first_name,
            last_name: me?.last_name,
            email: me?.email,
            timezone: me?.timezone,
            locale: me?.locale,
            marketing_opt_in: me?.marketing_opted_in_at !== null,
        },
    });

    const passwordForm = useForm({
        initialValues: {
            current_password: '',
            password: '',
            password_confirmation: '',
        }
    });

    useEffect(() => {
        profileForm.setValues({
            first_name: me?.first_name,
            last_name: me?.last_name,
            email: me?.email,
            timezone: me?.timezone,
            locale: me?.locale,
            marketing_opt_in: me?.marketing_opted_in_at !== null,
        });
    }, [me]);

    const clearParam = (name: string) => setSearchParams(params => {
        params.delete(name);
        return params;
    }, {replace: true});

    // The link of the « confirm your email » email: confirmed as soon as the page opens, once.
    useEffect(() => {
        if (!confirmEmailToken || !me?.id || confirmedToken.current === confirmEmailToken) {
            return;
        }
        confirmedToken.current = confirmEmailToken;
        confirmEmailAddress.mutate({token: confirmEmailToken, userId: me.id}, {
            onSuccess: () => showSuccess(t`Successfully confirmed email address`),
            onError: () => showError(t`Error confirming email address`),
            onSettled: () => clearParam('confirm-email'),
        });
    }, [confirmEmailToken, me?.id]);

    const handleProfileFormSubmit = (formValues: Partial<UserMeRequest>, form: UseFormReturnType<any>) => {
        mutation.mutate({
            userData: formValues,
        }, {
            onSuccess: () => {
                form.reset();
                showSuccess(t`Profile updated successfully`);
                document.cookie = `locale=${formValues.locale};path=/;max-age=31536000`;

                if (form.isDirty('locale')) {
                    window.location.reload();
                }
            },
            onError: (error: any) => {
                errorHandler(form, error);
            }
        })
    }

    const handleCancelEmailChange = () => {
        cancelEmailChangeMutation.mutate({
            userId: me?.id
        }, {
            onSuccess: () => {
                showSuccess(t`Email change cancelled successfully`)
            },
            onError: () => {
                showError(t`Something went wrong. Please try again.`)
            }
        })
    }

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

    const handleConfirmEmailChange = () => {
        if (!emailChangeToken || !me?.id) {
            return;
        }
        confirmEmailChange.mutate({token: emailChangeToken, userId: me.id}, {
            onSuccess: () => {
                showSuccess(t`Successfully confirmed email change`);
                clearParam('confirm-email-change');
            },
            onError: () => showError(t`Error confirming email change`),
        });
    };

    return (
        <div className={settings.page}>
            <header className={settings.header}>
                <h1 className={settings.title}>{t`My Profile`}</h1>
                <p className={settings.subtitle}>{t`Your details, your language and your password.`}</p>
            </header>

            <form className={settings.grid}
                  onSubmit={profileForm.onSubmit((values) => handleProfileFormSubmit(values, profileForm))}>
                <SettingsCard title={t`Personal Information`}>
                    <fieldset className={classes.fieldset} disabled={isFetching}>
                        <div className={settings.fields}>
                            <TextInput className={settings.field} required label={t`First Name`}
                                       {...profileForm.getInputProps('first_name')}/>
                            <TextInput className={settings.field} required label={t`Last Name`}
                                       {...profileForm.getInputProps('last_name')}/>
                            <TextInput className={`${settings.field} ${settings.fieldsSpan}`} required type="email"
                                       label={t`Email`} {...profileForm.getInputProps('email')}/>
                        </div>

                        {me?.has_pending_email_change && (
                            <div className={classes.note}>
                                <p>
                                    <Trans>Your email request change to <b>{me?.pending_email}</b> is pending.
                                        Please check your email to confirm</Trans>
                                </p>
                                <p>{t`If you did not request this change, please immediately change your password.`}</p>
                                <button type="button" className={settings.textButton} onClick={handleCancelEmailChange}>
                                    {t`Cancel email change`}
                                </button>
                            </div>
                        )}

                        {me && !me.is_email_verified && !emailConfirmationResent && (
                            <div className={classes.note}>
                                <p><b>{t`Email not verified`}</b> · {t`Please verify your email address to access all features`}</p>
                                <button type="button" className={settings.textButton}
                                        disabled={resendEmailConfirmationMutation.isPending}
                                        onClick={handleEmailConfirmationResend}>
                                    {resendEmailConfirmationMutation.isPending ? t`Resending...` : t`Resend email confirmation`}
                                </button>
                            </div>
                        )}

                        {emailConfirmationResent && (
                            <div className={classes.note}>
                                <p><b>{t`Email confirmation resent`}</b> · {t`Please check your email to confirm your email address`}</p>
                            </div>
                        )}
                    </fieldset>
                </SettingsCard>

                <SettingsCard title={t`Regional Settings`}>
                    <fieldset className={classes.fieldset} disabled={isFetching}>
                        <div className={settings.fields}>
                            <Select className={settings.field} required searchable data={timezones}
                                    label={t`Timezone`} placeholder={t`UTC`}
                                    {...profileForm.getInputProps('timezone')}/>
                            <Select className={settings.field} required data={localeSelectData} label={t`Language`}
                                    value={profileForm.values.locale || ''}
                                    onChange={(value) => value && profileForm.setFieldValue('locale', value as SupportedLocales)}/>
                        </div>
                        <ToggleRow
                            label={t`Receive product updates from ${appName}.`}
                            checked={!!profileForm.values.marketing_opt_in}
                            onChange={(checked) => profileForm.setFieldValue('marketing_opt_in', checked)}
                            disabled={isFetching}
                        />
                    </fieldset>
                </SettingsCard>

                <div className={`${settings.full} ${classes.actions}`}>
                    <Button type="submit" variant="transparent" className={settings.inkButton} loading={mutation.isPending}
                            disabled={isFetching || !profileForm.isDirty()}>
                        {t`Update profile`}
                    </Button>
                </div>
            </form>

            <form className={settings.grid}
                  onSubmit={passwordForm.onSubmit((values) => handleProfileFormSubmit(values, passwordForm))}>
                <SettingsCard title={t`Password`}>
                    <fieldset className={classes.fieldset} disabled={isFetching}>
                        <PasswordInput className={settings.field} required label={t`Current Password`}
                                       {...passwordForm.getInputProps('current_password')}/>
                        <PasswordInput className={settings.field} required label={t`New Password`}
                                       {...passwordForm.getInputProps('password')}/>
                        <PasswordInput className={settings.field} required label={t`Confirm New Password`}
                                       {...passwordForm.getInputProps('password_confirmation')}/>
                        <div className={classes.actions}>
                            <Button type="submit" variant="transparent" className={settings.outlineButton}
                                    loading={mutation.isPending}>
                                {t`Change password`}
                            </Button>
                        </div>
                    </fieldset>
                </SettingsCard>
            </form>

            {/* The link of the « confirm your new email » email. */}
            <Modal opened={!!emailChangeToken && isFetched} onClose={() => clearParam('confirm-email-change')}
                   heading={t`Confirm Email Change`}>
                {me?.pending_email ? (
                    <div className={classes.modalBody}>
                        <p><Trans>You are changing your email to <b>{me?.pending_email}</b>.</Trans></p>
                        <Button variant="transparent" className={settings.inkButton} loading={confirmEmailChange.isPending}
                                onClick={handleConfirmEmailChange}>
                            {t`Confirm Email Change`}
                        </Button>
                    </div>
                ) : (
                    <p>{t`You have no pending email change.`}</p>
                )}
            </Modal>
        </div>
    );
}

export default ManageProfile;
