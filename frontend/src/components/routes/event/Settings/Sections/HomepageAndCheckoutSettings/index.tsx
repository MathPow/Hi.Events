import {t} from "@lingui/macro";
import {Button, Center, Input, NumberInput, Paper, SegmentedControl, Switch, Text, TextInput, Tooltip, VisuallyHidden} from "@mantine/core";
import {useForm} from "@mantine/form";
import {useParams} from "react-router";
import {useEffect} from "react";
import {EventSettings} from "../../../../../../types.ts";
import {Card} from "../../../../../common/Card";
import {showSuccess} from "../../../../../../utilites/notifications.tsx";
import {useFormErrorResponseHandler} from "../../../../../../hooks/useFormErrorResponseHandler.tsx";
import {useUpdateEventSettings} from "../../../../../../mutations/useUpdateEventSettings.ts";
import {useGetEventSettings} from "../../../../../../queries/useGetEventSettings.ts";
import {Editor} from "../../../../../common/Editor";
import {HeadingWithDescription} from "../../../../../common/Card/CardHeading";
import {isEmptyHtml} from "../../../../../../utilites/helpers.ts";
import {CustomSelect, ItemProps} from "../../../../../common/CustomSelect";
import {IconLink, IconUser, IconUsers} from "@tabler/icons-react";
import {
    DEFAULT_PRODUCT_INFO_ICON,
    getProductInfoIconLabels,
    PRODUCT_INFO_ICONS,
    ProductInfoIconKey,
} from "../../../../../../constants/productInfoIcons.ts";

export const HomepageAndCheckoutSettings = () => {
    const {eventId} = useParams();
    const eventSettingsQuery = useGetEventSettings(eventId);
    const updateMutation = useUpdateEventSettings();
    const form = useForm({
        initialValues: {
            pre_checkout_message: '',
            post_checkout_message: '',
            product_info_message: '',
            product_info_button_text: '',
            product_info_button_url: '',
            product_info_icon: DEFAULT_PRODUCT_INFO_ICON as string,
            order_timeout_in_minutes: 15,
            attendee_details_collection_method: 'PER_TICKET' as 'PER_TICKET' | 'PER_ORDER',
            show_marketing_opt_in: true,
            allow_copy_details_to_all_attendees: true,
        },
        transformValues: (values) => ({
            ...values,
            pre_checkout_message: isEmptyHtml(values.pre_checkout_message) ? null : values.pre_checkout_message,
            post_checkout_message: isEmptyHtml(values.post_checkout_message) ? null : values.post_checkout_message,
            product_info_message: isEmptyHtml(values.product_info_message) ? null : values.product_info_message,
            product_info_button_text: values.product_info_button_text.trim() || null,
            product_info_button_url: values.product_info_button_url.trim() || null,
        }),
    });

    const attendeeCollectionOptions: ItemProps[] = [
        {
            icon: <IconUsers/>,
            label: t`Per ticket`,
            value: 'PER_TICKET',
            description: t`Collect attendee details for each ticket purchased.`,
        },
        {
            icon: <IconUser/>,
            label: t`Per order`,
            value: 'PER_ORDER',
            description: t`Use order details for all attendees. Attendee names and emails will match the buyer's information.`,
        },
    ];
    const iconLabels = getProductInfoIconLabels();
    const iconOptions = (Object.keys(PRODUCT_INFO_ICONS) as ProductInfoIconKey[]).map((key) => {
        const Icon = PRODUCT_INFO_ICONS[key];
        return {
            value: key,
            label: (
                <Tooltip label={iconLabels[key]} withArrow openDelay={300}>
                    <Center>
                        <Icon size={18} stroke={1.75}/>
                        <VisuallyHidden>{iconLabels[key]}</VisuallyHidden>
                    </Center>
                </Tooltip>
            ),
        };
    });
    const formErrorHandle = useFormErrorResponseHandler();

    useEffect(() => {
        if (eventSettingsQuery?.isFetched && eventSettingsQuery?.data) {
            form.setValues({
                pre_checkout_message: eventSettingsQuery.data.pre_checkout_message,
                post_checkout_message: eventSettingsQuery.data.post_checkout_message,
                product_info_message: eventSettingsQuery.data.product_info_message || '',
                product_info_button_text: eventSettingsQuery.data.product_info_button_text || '',
                product_info_button_url: eventSettingsQuery.data.product_info_button_url || '',
                product_info_icon: eventSettingsQuery.data.product_info_icon || DEFAULT_PRODUCT_INFO_ICON,
                order_timeout_in_minutes: eventSettingsQuery.data.order_timeout_in_minutes,
                attendee_details_collection_method: eventSettingsQuery.data.attendee_details_collection_method || 'PER_TICKET',
                show_marketing_opt_in: eventSettingsQuery.data.show_marketing_opt_in ?? true,
                allow_copy_details_to_all_attendees: eventSettingsQuery.data.allow_copy_details_to_all_attendees ?? true,
            });
        }
    }, [eventSettingsQuery.isFetched]);

    const handleSubmit = (values: Partial<EventSettings>) => {
        updateMutation.mutate({
            eventSettings: values,
            eventId: eventId,
        }, {
            onSuccess: () => {
                showSuccess(t`Successfully Updated Homepage Settings`);
            },
            onError: (error) => {
                formErrorHandle(form, error);
            }
        });
    }

    return (
        <Card>
            <HeadingWithDescription
                heading={t`Checkout Settings`}
                description={t`Customize the event homepage and checkout messaging`}
            />
            <form onSubmit={form.onSubmit(handleSubmit as any)}>
                <fieldset disabled={eventSettingsQuery.isLoading || updateMutation.isPending}>
                    <Editor
                        label={t`Pre Checkout message`}
                        value={form.values.pre_checkout_message || ''}
                        description={t`Shown to the customer before they checkout`}
                        onChange={(value) => form.setFieldValue('pre_checkout_message', value)}
                    />

                    <Editor
                        label={t`Post Checkout message`}
                        value={form.values.post_checkout_message || ''}
                        description={(
                            <>
                                <p>
                                    {t`Shown to the customer after they checkout, on the order summary page.`}
                                </p>
                                <p>
                                    {t`This message will only be shown if order is completed successfully. Orders awaiting payment will not show this message`}
                                </p>
                            </>
                        )}
                        onChange={(value) => form.setFieldValue('post_checkout_message', value)}
                    />

                    <Paper withBorder p="md" radius="md" mb="md">
                        <Text size="lg" fw={500} mb="xs">{t`Information block`}</Text>
                        <Text size="sm" c="dimmed" mb="md">
                            {t`Shown below the promo code field on the ticket selection, and in a compact version on the details step, just above the secure checkout notice. Use it to share important information or invite buyers to make an extra donation on another platform.`}
                        </Text>
                        <Editor
                            editorType={'simple'}
                            label={t`Message`}
                            value={form.values.product_info_message || ''}
                            error={form.errors.product_info_message as string}
                            onChange={(value) => form.setFieldValue('product_info_message', value)}
                        />
                        <Input.Wrapper label={t`Icon`} description={t`Shown next to the message.`} mb="md">
                            <SegmentedControl
                                mt={6}
                                data={iconOptions}
                                {...form.getInputProps('product_info_icon')}
                            />
                        </Input.Wrapper>
                        <TextInput
                            label={t`Button text`}
                            description={t`Leave the button text and link empty to show the message without a button.`}
                            placeholder={t`e.g. Make a donation`}
                            maxLength={100}
                            {...form.getInputProps('product_info_button_text')}
                        />
                        <TextInput
                            label={t`Button link`}
                            description={t`Opens in a new tab.`}
                            placeholder={'https://'}
                            type={'url'}
                            leftSection={<IconLink size={16}/>}
                            {...form.getInputProps('product_info_button_url')}
                        />
                    </Paper>

                    <CustomSelect
                        optionList={attendeeCollectionOptions}
                        form={form}
                        name={'attendee_details_collection_method'}
                        label={t`Attendee information collection`}
                        required
                    />

                    <NumberInput
                        label={t`Order timeout`}
                        description={t`How many minutes the customer has to complete their order. We recommend at least 15 minutes`}
                        {...form.getInputProps('order_timeout_in_minutes')}
                    />

                    <Switch
                        mt="md"
                        label={t`Show marketing opt-in checkbox`}
                        description={t`Display a checkbox allowing customers to opt-in to receive marketing communications from this event organizer.`}
                        {...form.getInputProps('show_marketing_opt_in', {type: 'checkbox'})}
                    />

                    <Switch
                        mt="md"
                        label={t`Allow buyers to copy their details to all attendees`}
                        description={t`When enabled, buyers can copy their own name and email onto all attendees at once. Turn this off to remove the "All attendees" option; buyers can still copy to the first attendee, and the rest must be entered individually.`}
                        {...form.getInputProps('allow_copy_details_to_all_attendees', {type: 'checkbox'})}
                    />

                    <Button loading={updateMutation.isPending} type={'submit'}>
                        {t`Save`}
                    </Button>
                </fieldset>
            </form>
        </Card>
    );
}
