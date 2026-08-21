import {useParams} from "react-router";
import {useForm} from "@mantine/form";
import {useEffect} from "react";
import {t, Trans} from "@lingui/macro";
import {Alert, Button, TextInput, Textarea} from "@mantine/core";
import {IconAlertTriangle} from "@tabler/icons-react";
import {Card} from "../../../../../common/Card";
import {HeadingWithDescription} from "../../../../../common/Card/CardHeading";
import {useGetOrganizerSettings} from "../../../../../../queries/useGetOrganizerSettings.ts";
import {useUpdateOrganizerSettings} from "../../../../../../mutations/useUpdateOrganizerSettings.ts";
import {useFormErrorResponseHandler} from "../../../../../../hooks/useFormErrorResponseHandler.tsx";
import {showSuccess} from "../../../../../../utilites/notifications.tsx";
import {InputGroup} from "../../../../../common/InputGroup";

/**
 * Identite de l'organisme emetteur des recus officiels aux fins de l'impot.
 *
 * Le numero d'enregistrement fait office d'interrupteur: tant qu'il est vide,
 * aucun recu n'est emis nulle part dans l'application.
 */
export const CharitySettings = () => {
    const {organizerId} = useParams();
    const organizerSettingsQuery = useGetOrganizerSettings(organizerId);
    const updateMutation = useUpdateOrganizerSettings();
    const formErrorHandle = useFormErrorResponseHandler();

    const form = useForm({
        initialValues: {
            charity_registration_number: '',
            charity_legal_name: '',
            charity_address: '',
            charity_signatory_name: '',
            charity_receipt_prefix: '',
        }
    });

    useEffect(() => {
        if (organizerSettingsQuery?.isFetched && organizerSettingsQuery?.data) {
            const data = organizerSettingsQuery.data;
            form.setValues({
                charity_registration_number: data.charity_registration_number ?? '',
                charity_legal_name: data.charity_legal_name ?? '',
                charity_address: data.charity_address ?? '',
                charity_signatory_name: data.charity_signatory_name ?? '',
                charity_receipt_prefix: data.charity_receipt_prefix ?? '',
            });
        }
    }, [organizerSettingsQuery.isFetched]);

    const handleSubmit = (values: typeof form.values) => {
        updateMutation.mutate({
            organizerSettings: values,
            organizerId: organizerId,
        }, {
            onSuccess: () => showSuccess(t`Charity settings updated`),
            onError: (error) => formErrorHandle(form, error),
        });
    };

    return (
        <Card>
            <HeadingWithDescription
                heading={t`Tax receipts`}
                description={t`Issue official donation receipts for the charitable portion of an order.`}
            />

            <Alert icon={<IconAlertTriangle size={18}/>} color="orange" mb={20} variant="light">
                <Trans>
                    Only a registered charity may issue official receipts. Leave the registration
                    number empty and no receipt will ever be issued. You remain responsible for the
                    accuracy of every receipt, including the valuation of any advantage received by
                    the donor.
                </Trans>
            </Alert>

            <form onSubmit={form.onSubmit(handleSubmit)}>
                <fieldset disabled={organizerSettingsQuery.isLoading || updateMutation.isPending}>
                    <TextInput
                        {...form.getInputProps('charity_registration_number')}
                        label={t`Charity registration number`}
                        description={t`Turns receipts on. Example: 123456789 RR0001`}
                        placeholder="123456789 RR0001"
                    />
                    <TextInput
                        {...form.getInputProps('charity_legal_name')}
                        label={t`Legal name of the charity`}
                        description={t`As registered. Defaults to the organizer name if left empty.`}
                    />
                    <Textarea
                        {...form.getInputProps('charity_address')}
                        label={t`Address`}
                        description={t`Printed on the receipt. The last line is used as the place of issue.`}
                        autosize
                        minRows={3}
                    />
                    <InputGroup>
                        <TextInput
                            {...form.getInputProps('charity_signatory_name')}
                            label={t`Authorized signatory`}
                        />
                        <TextInput
                            {...form.getInputProps('charity_receipt_prefix')}
                            label={t`Receipt number prefix`}
                            description={t`Defaults to the year, e.g. 2026-1`}
                            placeholder="2026-"
                        />
                    </InputGroup>

                    <Button type="submit" loading={updateMutation.isPending}>
                        {t`Save`}
                    </Button>
                </fieldset>
            </form>
        </Card>
    );
};
