import {t} from "@lingui/macro";
import {Button} from "@mantine/core";
import {useForm} from "@mantine/form";
import {IdParam, Question} from "../../../../types.ts";
import {QuestionInput} from "../../../common/CheckoutQuestion";
import {HolderDetailsInput} from "../../../../api/ticketTransfer.client.ts";
import {useSaveTransferredHolderDetails} from "../../../../mutations/useSaveTransferredHolderDetails.ts";
import {useFormErrorResponseHandler} from "../../../../hooks/useFormErrorResponseHandler.tsx";
import {showSuccess} from "../../../../utilites/notifications.tsx";
import print from "../PrintOrder/PrintOrder.module.scss";
import classes from './AttendeeProductAndInformation.module.scss';

/**
 * A transferred ticket's new holder gives their own participant details (the previous holder's
 * were erased), before signing: their date of birth decides whether a parent signs with them.
 */
export const HolderDetailsCard = ({eventId, attendeeShortId, questions, onSaved}: {
    eventId: IdParam,
    attendeeShortId: string,
    questions: Question[],
    onSaved: () => Promise<unknown>,
}) => {
    const mutation = useSaveTransferredHolderDetails();
    const errorHandler = useFormErrorResponseHandler();
    const form = useForm<HolderDetailsInput>({
        initialValues: {
            questions: questions.map(question => ({question_id: question.id as IdParam, response: {}})),
        },
    });

    const submit = (input: HolderDetailsInput) => mutation.mutate({eventId, attendeeShortId, input}, {
        onSuccess: async () => {
            showSuccess(t`Thank you, your details are saved.`);
            await onSaved();
        },
        onError: (error) => errorHandler(form, error),
    });

    return (
        <section id="signer" className={`${classes.signCard} ${print.screenOnly}`} data-rough>
            <h2 className={classes.signTitle}>{t`Your participant details`}</h2>
            <p className={classes.signIntro}>
                {t`This ticket was transferred to you. The organizer asks each participant for these details: fill them in before the event.`}
            </p>
            <form onSubmit={form.onSubmit(submit)}>
                {questions.map((question, index) => (
                    <QuestionInput key={question.id} question={question} name={`questions.${index}.response`} form={form}/>
                ))}
                <Button type="submit" mt="lg" loading={mutation.isPending}>{t`Save`}</Button>
            </form>
        </section>
    );
};
