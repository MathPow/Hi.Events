import {t} from "@lingui/macro";
import {ActionIcon, Button, Group, Text, Textarea, TextInput, Tooltip} from "@mantine/core";
import {useForm} from "@mantine/form";
import {IconArrowDown, IconArrowUp, IconHelpCircle, IconPlus, IconTrash} from "@tabler/icons-react";
import {useEffect} from "react";
import {useParams} from "react-router";
import {PageBody} from "../../../common/PageBody";
import {PageTitle} from "../../../common/PageTitle";
import {Card} from "../../../common/Card";
import {HeadingWithDescription} from "../../../common/Card/CardHeading";
import {useGetOrganizerSettings} from "../../../../queries/useGetOrganizerSettings.ts";
import {useUpdateOrganizerSettings} from "../../../../mutations/useUpdateOrganizerSettings.ts";
import {useFormErrorResponseHandler} from "../../../../hooks/useFormErrorResponseHandler.tsx";
import {showSuccess} from "../../../../utilites/notifications.tsx";
import {OrganizerFaq} from "../../../../types.ts";
import classes from "./Faq.module.scss";

const MAX_FAQS = 50;

const Faq = () => {
    const {organizerId} = useParams();
    const settingsQuery = useGetOrganizerSettings(organizerId);
    const updateMutation = useUpdateOrganizerSettings();
    const formErrorHandle = useFormErrorResponseHandler();
    const form = useForm<{ faqs: OrganizerFaq[] }>({
        initialValues: {faqs: []},
        validate: {
            faqs: {
                question: (value) => value.trim() ? null : t`Question is required`,
                answer: (value) => value.trim() ? null : t`Answer is required`,
            },
        },
    });

    useEffect(() => {
        if (settingsQuery.isFetched && settingsQuery.data) {
            form.setValues({faqs: settingsQuery.data.faqs ?? []});
            form.resetDirty({faqs: settingsQuery.data.faqs ?? []});
        }
    }, [settingsQuery.isFetched]);

    const handleSubmit = (values: { faqs: OrganizerFaq[] }) => {
        updateMutation.mutate({
            organizerId,
            organizerSettings: {faqs: values.faqs},
        }, {
            onSuccess: () => {
                form.resetDirty(values);
                showSuccess(t`FAQ saved`);
            },
            onError: (error) => formErrorHandle(form, error),
        });
    };

    const addQuestion = () => form.insertListItem('faqs', {question: '', answer: ''});
    const faqs = form.values.faqs;

    return (
        <PageBody>
            <PageTitle>{t`FAQ`}</PageTitle>
            <Card>
                <HeadingWithDescription
                    heading={t`Frequently asked questions`}
                    description={t`Answer common questions from your attendees. The questions appear at the bottom of your organizer homepage, in the order shown here.`}
                />
                <form onSubmit={form.onSubmit(handleSubmit)}>
                    <fieldset disabled={settingsQuery.isLoading || updateMutation.isPending}>
                        {faqs.length === 0 && (
                            <div className={classes.empty}>
                                <IconHelpCircle size={32} stroke={1.5}/>
                                <Text c="dimmed" size="sm">
                                    {t`No questions yet. The FAQ section stays hidden on your homepage until you add one.`}
                                </Text>
                            </div>
                        )}

                        {faqs.map((_, index) => (
                            <div key={index} className={classes.item}>
                                <div className={classes.itemHeader}>
                                    <Text fw={600} size="sm">{t`Question ${index + 1}`}</Text>
                                    <Group gap={4}>
                                        <Tooltip label={t`Move up`}>
                                            <ActionIcon
                                                variant="subtle"
                                                color="gray"
                                                disabled={index === 0}
                                                aria-label={t`Move up`}
                                                onClick={() => form.reorderListItem('faqs', {from: index, to: index - 1})}
                                            >
                                                <IconArrowUp size={16}/>
                                            </ActionIcon>
                                        </Tooltip>
                                        <Tooltip label={t`Move down`}>
                                            <ActionIcon
                                                variant="subtle"
                                                color="gray"
                                                disabled={index === faqs.length - 1}
                                                aria-label={t`Move down`}
                                                onClick={() => form.reorderListItem('faqs', {from: index, to: index + 1})}
                                            >
                                                <IconArrowDown size={16}/>
                                            </ActionIcon>
                                        </Tooltip>
                                        <Tooltip label={t`Delete`}>
                                            <ActionIcon
                                                variant="subtle"
                                                color="red"
                                                aria-label={t`Delete`}
                                                onClick={() => form.removeListItem('faqs', index)}
                                            >
                                                <IconTrash size={16}/>
                                            </ActionIcon>
                                        </Tooltip>
                                    </Group>
                                </div>
                                <TextInput
                                    {...form.getInputProps(`faqs.${index}.question`)}
                                    label={t`Question`}
                                    placeholder={t`Is there parking on site?`}
                                    maxLength={255}
                                    required
                                />
                                <Textarea
                                    {...form.getInputProps(`faqs.${index}.answer`)}
                                    label={t`Answer`}
                                    placeholder={t`Yes, free parking is available next to the entrance.`}
                                    maxLength={5000}
                                    autosize
                                    minRows={3}
                                    required
                                />
                            </div>
                        ))}

                        <Group justify="space-between" mt="md">
                            <Button
                                variant="light"
                                leftSection={<IconPlus size={16}/>}
                                onClick={addQuestion}
                                disabled={faqs.length >= MAX_FAQS}
                            >
                                {t`Add a question`}
                            </Button>
                            <Button type="submit" loading={updateMutation.isPending} disabled={!form.isDirty()}>
                                {t`Save`}
                            </Button>
                        </Group>
                    </fieldset>
                </form>
            </Card>
        </PageBody>
    );
};

export default Faq;
