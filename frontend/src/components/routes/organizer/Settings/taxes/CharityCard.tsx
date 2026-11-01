import {useRef} from "react";
import {t, Trans} from "@lingui/macro";
import {Textarea, TextInput} from "@mantine/core";
import {useForm} from "@mantine/form";
import {IconAlertTriangle, IconLock} from "@tabler/icons-react";
import {Account, IdParam, OrganizerSettings} from "../../../../../types.ts";
import {useUpdateOrganizerSettings} from "../../../../../mutations/useUpdateOrganizerSettings.ts";
import {useSectionAutosave} from "../../../../layouts/AppLayout/PageStatus.tsx";
import {SettingsCard, showServerErrors} from "../SettingsUi.tsx";
import classes from "../Settings.module.scss";

type Charity = Record<'charity_registration_number' | 'charity_legal_name' | 'charity_address' | 'charity_signatory_name' | 'charity_receipt_prefix', string>;

const fromSettings = (settings: OrganizerSettings): Charity => ({
    charity_registration_number: settings.charity_registration_number ?? '',
    charity_legal_name: settings.charity_legal_name ?? '',
    charity_address: settings.charity_address ?? '',
    charity_signatory_name: settings.charity_signatory_name ?? '',
    charity_receipt_prefix: settings.charity_receipt_prefix ?? '',
});

/**
 * « Reçus fiscaux »: the charity issuing the official donation receipts. The registration number is
 * the switch: while it is empty, no receipt is ever issued.
 */
export const CharityCard = ({organizerId, settings, account}: {
    organizerId: IdParam,
    settings: OrganizerSettings,
    account: Account,
}) => {
    const updateSettings = useUpdateOrganizerSettings();
    const form = useForm<Charity>({initialValues: fromSettings(settings)});
    const saved = useRef<Charity>(fromSettings(settings));

    const queue = useSectionAutosave<Charity>('charity', (changes) => updateSettings.mutateAsync({
        organizerId,
        organizerSettings: Object.fromEntries(Object.entries(changes).map(([field, value]) => [field, value || null])),
    }), {
        onSaved: (changes) => Object.entries(changes).forEach(([field, value]) => {
            saved.current = {...saved.current, [field]: value};
            form.clearFieldError(field);
        }),
        onFailed: (error) => showServerErrors(form, error),
    });

    const commit = (field: keyof Charity) => {
        const value = form.values[field].trim();
        if (value !== saved.current[field].trim()) {
            queue({[field]: value});
        }
    };

    const field = (name: keyof Charity) => ({...form.getInputProps(name), onBlur: () => commit(name)});

    return (
        <SettingsCard title={t`Tax receipts`} subtitle={t`Issue official donation receipts for the charitable portion of an order.`}>
            {account.donation_receipts_allowed === false && (
                <div className={classes.notice}>
                    <IconLock size={18}/>
                    <span>
                        <Trans>
                            Official receipts must be activated for your account by our team before any is
                            issued. Fill in your charity details, then contact us so we can check your
                            registration number.
                        </Trans>
                    </span>
                </div>
            )}
            <div className={`${classes.notice} ${classes.noticeWarning}`}>
                <IconAlertTriangle size={18}/>
                <span>
                    <Trans>
                        Only a registered charity may issue official receipts. Leave the registration
                        number empty and no receipt will ever be issued. You remain responsible for the
                        accuracy of every receipt, including the valuation of any advantage received by
                        the donor.
                    </Trans>
                </span>
            </div>
            <TextInput
                className={classes.field}
                label={t`Charity registration number`}
                description={t`Turns receipts on. Example: 123456789 RR0001`}
                placeholder="123456789 RR0001"
                {...field('charity_registration_number')}
            />
            <TextInput
                className={classes.field}
                label={t`Legal name of the charity`}
                description={t`As registered. Defaults to the organizer name if left empty.`}
                {...field('charity_legal_name')}
            />
            <Textarea
                className={classes.field}
                label={t`Address`}
                description={t`Printed on the receipt. The last line is used as the place of issue.`}
                autosize
                minRows={3}
                {...field('charity_address')}
            />
            <div className={classes.fields}>
                <TextInput
                    className={classes.field}
                    label={t`Authorized signatory`}
                    {...field('charity_signatory_name')}
                />
                <TextInput
                    className={classes.field}
                    label={t`Receipt number prefix`}
                    description={t`Defaults to the year, e.g. 2026-1`}
                    placeholder="2026-"
                    {...field('charity_receipt_prefix')}
                />
            </div>
        </SettingsCard>
    );
};
