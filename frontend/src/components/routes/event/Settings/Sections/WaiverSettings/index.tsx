import {t} from "@lingui/macro";
import {Button} from "@mantine/core";
import {useForm} from "@mantine/form";
import {useParams} from "react-router";
import {useEffect} from "react";
import {Card} from "../../../../../common/Card";
import {Editor} from "../../../../../common/Editor";
import {showSuccess} from "../../../../../../utilites/notifications.tsx";
import {isEmptyHtml} from "../../../../../../utilites/helpers.ts";
import {useFormErrorResponseHandler} from "../../../../../../hooks/useFormErrorResponseHandler.tsx";
import {useUpdateEventSettings} from "../../../../../../mutations/useUpdateEventSettings.ts";
import {useGetEventSettings} from "../../../../../../queries/useGetEventSettings.ts";
import {HeadingWithDescription} from "../../../../../common/Card/CardHeading";

/**
 * The event's waiver: with a text, every ticket's attendee accepts it at
 * checkout and signs with their full name, a parent or guardian for a minor.
 */
export const WaiverSettings = () => {
    const {eventId} = useParams();
    const eventSettingsQuery = useGetEventSettings(eventId);
    const updateMutation = useUpdateEventSettings();
    const form = useForm({
        initialValues: {
            waiver_text: '',
        }
    });
    const formErrorHandle = useFormErrorResponseHandler();

    useEffect(() => {
        if (eventSettingsQuery?.isFetched && eventSettingsQuery?.data) {
            form.setValues({
                waiver_text: eventSettingsQuery.data.waiver_text ?? '',
            });
        }
    }, [eventSettingsQuery.isFetched]);

    const handleSubmit = (values: typeof form.values) => {
        updateMutation.mutate({
            eventSettings: {
                waiver_text: isEmptyHtml(values.waiver_text) ? null : values.waiver_text,
            },
            eventId: eventId,
        }, {
            onSuccess: () => {
                showSuccess(t`Successfully Updated Settings`);
            },
            onError: (error) => {
                formErrorHandle(form, error);
            }
        });
    };

    return (
        <Card>
            <HeadingWithDescription
                heading={t`Liability waiver`}
                description={t`Each attendee accepts it at checkout and signs with their full name. For a participant under 18 on the event day, a parent or guardian signs too: add the participant form to ask for the date of birth. Leave empty for no waiver.`}
            />
            <form onSubmit={form.onSubmit(handleSubmit)}>
                <fieldset disabled={eventSettingsQuery.isLoading || updateMutation.isPending}>
                    <Editor
                        label={t`Waiver text`}
                        description={t`Signatures already collected keep the text as it read when they were signed.`}
                        value={form.values.waiver_text || ''}
                        onChange={(value) => form.setFieldValue('waiver_text', value)}
                        error={form.errors.waiver_text as string}
                    />

                    <Button loading={updateMutation.isPending} type="submit" mt="xl">
                        {t`Save`}
                    </Button>
                </fieldset>
            </form>
        </Card>
    );
};
