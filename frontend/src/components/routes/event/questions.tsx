import {useParams} from "react-router";
import {PageBody} from "../../common/PageBody";
import {useGetEventQuestions} from "../../../queries/useGetEventQuestions.ts";
import {QuestionsTable} from "../../common/QuestionsTable";

export const Questions = () => {
    const {eventId} = useParams();
    const questionQuery = useGetEventQuestions(eventId);

    return (
        <PageBody>
            <QuestionsTable questions={questionQuery?.data}/>
        </PageBody>
    );
};

export default Questions;
