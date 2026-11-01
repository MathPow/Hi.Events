import {useParams} from "react-router";
import {Skeleton} from "@mantine/core";
import {PageBody} from "../../common/PageBody";
import {useGetEventQuestions} from "../../../queries/useGetEventQuestions.ts";
import {QuestionsTable} from "../../common/QuestionsTable";

export const Questions = () => {
    const {eventId} = useParams();
    const questionQuery = useGetEventQuestions(eventId);
    const questions = questionQuery?.data;

    return (
        <PageBody>
            {!questions && (
                <>
                    <Skeleton height={110} radius={20} mb="lg"/>
                    <Skeleton height={320} radius={32}/>
                </>
            )}
            {questions && <QuestionsTable questions={questions}/>}
        </PageBody>
    );
};

export default Questions;
