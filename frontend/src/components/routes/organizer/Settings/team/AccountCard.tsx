import {useRef} from "react";
import {t} from "@lingui/macro";
import {Select, TextInput} from "@mantine/core";
import {useForm} from "@mantine/form";
import {Account} from "../../../../../types.ts";
import {useUpdateAccount} from "../../../../../mutations/useUpdateAccount.ts";
import {currencies} from "../../../../../../data/currencies.ts";
import {timezones} from "../../../../../../data/timezones.ts";
import {useSectionAutosave} from "../../../../layouts/AppLayout/PageStatus.tsx";
import {currencyName, SettingsCard, showServerErrors} from "../SettingsUi.tsx";
import classes from "../Settings.module.scss";

type AccountFields = { name: string, currency_code: string, timezone: string };

// « Compte »: the account all the organizers and the team belong to. Read only for organizers.
export const AccountCard = ({account, isAdmin}: { account: Account, isAdmin: boolean }) => {
    const updateAccount = useUpdateAccount();
    const initial: AccountFields = {
        name: account.name ?? '',
        currency_code: account.currency_code ?? '',
        timezone: account.timezone ?? '',
    };
    const form = useForm<AccountFields>({initialValues: initial});
    const saved = useRef<AccountFields>(initial);
    const latest = useRef(form.values);
    latest.current = form.values;

    const queue = useSectionAutosave<AccountFields>('account', () => updateAccount.mutateAsync({
        accountData: {...latest.current} as Account,
    }), {
        onSaved: (changes) => Object.entries(changes).forEach(([field, value]) => {
            saved.current = {...saved.current, [field]: value};
            form.clearFieldError(field);
        }),
        onFailed: (error) => showServerErrors(form, error),
    });

    const commit = (field: keyof AccountFields, value: string = form.values[field]) => {
        if (value.trim() !== saved.current[field].trim()) {
            queue({[field]: value});
        }
    };

    const select = (field: 'currency_code' | 'timezone', value: string | null) => {
        if (value) {
            form.setFieldValue(field, value);
            commit(field, value);
        }
    };

    return (
        <SettingsCard title={t`Account`} subtitle={t`Your account name is used on event pages and in emails.`}>
            <TextInput
                className={classes.field}
                label={t`Account Name`}
                disabled={!isAdmin}
                {...form.getInputProps('name')}
                onBlur={() => commit('name')}
            />
            <Select
                className={classes.field}
                label={t`Currency`}
                description={t`The default currency for your events.`}
                searchable
                allowDeselect={false}
                disabled={!isAdmin}
                data={Object.entries(currencies).map(([label, code]) => ({value: code, label: currencyName(code, label)}))}
                value={form.values.currency_code}
                error={form.errors.currency_code}
                onChange={(value) => select('currency_code', value)}
            />
            <Select
                className={classes.field}
                label={t`Timezone`}
                description={t`The default timezone for your events.`}
                searchable
                allowDeselect={false}
                disabled={!isAdmin}
                data={timezones}
                value={form.values.timezone}
                error={form.errors.timezone}
                onChange={(value) => select('timezone', value)}
            />
        </SettingsCard>
    );
};
