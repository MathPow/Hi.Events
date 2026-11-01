import {ActionIcon, Button, Collapse, Tooltip} from '@mantine/core';
import {IdParam, Question, QuestionType} from "../../../types.ts";
import {
    IconChevronDown,
    IconDotsVertical,
    IconEye,
    IconEyeOff,
    IconFirstAidKit,
    IconGripVertical,
    IconPencil,
    IconPlus,
    IconShieldLock,
    IconTableExport,
    IconTrash,
} from "@tabler/icons-react";
import classes from "./QuestionsTable.module.scss";
import {QuestionInput} from "../CheckoutQuestion";
import {useForm} from "@mantine/form";
import {PageTitle} from "../PageTitle";
import {CreateQuestionModal} from "../../modals/CreateQuestionModal";
import {useDisclosure} from "@mantine/hooks";
import {t} from "@lingui/macro";
import {useEffect, useState} from "react";
import {EditQuestionModal} from "../../modals/EditQuestionModal";
import {useDeleteQuestion} from "../../../mutations/useDeleteQuestion.ts";
import {useParams} from "react-router";
import {showError, showSuccess} from "../../../utilites/notifications.tsx";
import {confirmationDialog} from "../../../utilites/confirmationDialog.tsx";
import {useDragItemsHandler} from "../../../hooks/useDragItemsHandler.ts";
import {closestCenter, DndContext, PointerSensor, TouchSensor, UniqueIdentifier, useSensor, useSensors} from "@dnd-kit/core";
import {SortableContext, useSortable, verticalListSortingStrategy} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {useSortQuestions} from "../../../mutations/useSortQuestions.ts";
import {useExportAnswers} from "../../../mutations/useExportAnswers.ts";
import {useGetEventSettings} from "../../../queries/useGetEventSettings.ts";
import {useUpdateEventSettings} from "../../../mutations/useUpdateEventSettings.ts";
import {useAddParticipantForm} from "../../../mutations/useAddParticipantForm.ts";
import {ActionMenu} from "../ActionMenu";
import {FilterChips} from "../FilterChips";
import {PillChoice} from "../../routes/organizer/Settings/SettingsUi.tsx";

interface QuestionsTableProp {
    questions: Partial<Question>[];
}

type QuestionBelongsTo = 'ORDER' | 'PRODUCT';

const typeLabel = (type?: QuestionType | string) => ({
    [QuestionType.SINGLE_LINE_TEXT]: t`Single line text box`,
    [QuestionType.MULTI_LINE_TEXT]: t`Multi line text box`,
    [QuestionType.CHECKBOX]: t`Checkboxes`,
    [QuestionType.RADIO]: t`Radio Option`,
    [QuestionType.DROPDOWN]: t`Dropdown selection`,
    [QuestionType.ADDRESS]: t`Address`,
    [QuestionType.DATE]: t`Date`,
} as Record<string, string>)[type ?? ''] ?? '';

const SortableQuestion = ({question, onEdit, onDelete}: {
    question: Partial<Question>;
    onEdit: (id: IdParam) => void;
    onDelete: (id: IdParam) => void;
}) => {
    const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({
        id: question.id as UniqueIdentifier,
    });
    const optionCount = question.options?.length ?? 0;

    return (
        <div
            ref={setNodeRef}
            style={{transform: CSS.Transform.toString(transform), transition}}
            className={classes.question}
            data-hidden={question.is_hidden || undefined}
            data-dragging={isDragging || undefined}
        >
            <button type="button" className={classes.grip} aria-label={t`Move`} {...attributes} {...listeners}>
                <IconGripVertical size={18} stroke={1.75}/>
            </button>

            <button type="button" className={classes.questionMain} onClick={() => onEdit(question.id as IdParam)}>
                <span className={classes.questionTitle}>{question.title}</span>
                <span className={classes.questionMeta}>
                    {typeLabel(question.type)}
                    {optionCount > 0 && ` · ${optionCount} ${t`options`}`}
                </span>
            </button>

            <div className={classes.tags}>
                {question.required && <span className={classes.tag} data-tone="ink">{t`Required`}</span>}
                {question.is_sensitive && (
                    <Tooltip label={t`Only the organizers see the answers. They are erased 30 days after the event.`} multiline w={240}>
                        <span className={classes.tag} data-tone="waiting"><IconShieldLock size={12}/>{t`Sensitive`}</span>
                    </Tooltip>
                )}
                {question.is_hidden && (
                    <Tooltip label={t`Hidden from attendees - only visible to organizers`}>
                        <span className={classes.tag} data-tone="neutral"><IconEyeOff size={12}/>{t`Hidden`}</span>
                    </Tooltip>
                )}
            </div>

            <ActionMenu
                target={(
                    <ActionIcon variant="subtle" className={classes.roundButton} aria-label={t`Actions`}>
                        <IconDotsVertical size={20}/>
                    </ActionIcon>
                )}
                itemsGroups={[
                    {
                        label: t`Manage`,
                        items: [{label: t`Edit`, icon: <IconPencil size={14}/>, onClick: () => onEdit(question.id as IdParam)}],
                    },
                    {
                        label: t`Danger zone`,
                        showDividerAbove: true,
                        items: [{
                            label: t`Delete`,
                            icon: <IconTrash size={14}/>,
                            color: 'red',
                            onClick: () => onDelete(question.id as IdParam),
                        }],
                    },
                ]}
            />
        </div>
    );
};

const QuestionsList = ({questions, onEdit, onAdd, emptyMessage, emptyHint}: {
    questions: Partial<Question>[];
    onEdit: (id: IdParam) => void;
    onAdd: () => void;
    emptyMessage: string;
    emptyHint: string;
}) => {
    const {eventId} = useParams();
    const deleteQuestionMutation = useDeleteQuestion();
    const sortMutation = useSortQuestions();
    const {items, setItems, handleDragEnd} = useDragItemsHandler({
        initialItemIds: questions.map((question) => Number(question.id)),
        onSortEnd: (newArray) => sortMutation.mutate({
            sortedQuestionIds: newArray.map((id, index) => ({id, order: index + 1})),
            eventId,
        }, {
            onSuccess: () => showSuccess(t`Questions reordered`),
            onError: () => showError(t`Failed to reorder questions`),
        }),
    });

    useEffect(() => {
        setItems(questions.map((question) => Number(question.id)));
    }, [questions]);

    const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 4}}), useSensor(TouchSensor));

    const onDelete = (id: IdParam) => confirmationDialog(t`Delete this question? This cannot be undone.`, () => {
        deleteQuestionMutation.mutate({eventId, questionId: id}, {
            onSuccess: () => showSuccess(t`Question deleted`),
            onError: (error: any) => showError(error?.response?.data?.message || t`Failed to delete question`),
        });
    });

    if (questions.length === 0) {
        return (
            <div className={classes.empty}>
                <p className={classes.emptyTitle}>{emptyMessage}</p>
                <p className={classes.emptyHint}>{emptyHint}</p>
                <Button variant="transparent" className={classes.outlineButton} leftSection={<IconPlus size={18}/>} onClick={onAdd}>
                    {t`Add Question`}
                </Button>
            </div>
        );
    }

    // In the dragged order right away, without waiting for the server.
    const ordered = items
        .map(id => questions.find(question => Number(question.id) === id))
        .filter((question): question is Partial<Question> => !!question);

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items as UniqueIdentifier[]} strategy={verticalListSortingStrategy}>
                <div className={classes.list}>
                    {ordered.map((question) => (
                        <SortableQuestion key={question.id} question={question} onEdit={onEdit} onDelete={onDelete}/>
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
};

const DefaultFields = () => (
    <div className={classes.defaultFields}>
        <span className={classes.fieldPill}>{t`First Name`}</span>
        <span className={classes.fieldPill}>{t`Last Name`}</span>
        <span className={classes.fieldPill}>{t`Email`}</span>
    </div>
);

const FormPreview = ({questions, isPerOrderCollection}: {
    questions: Partial<Question>[];
    isPerOrderCollection: boolean;
}) => {
    const form = useForm();
    const [isOpen, setIsOpen] = useState(false);

    form.getInputProps = (name: string) => ({
        id: name,
        value: form.values[name],
        onChange: () => void 0,
    });

    const orderQuestions = questions.filter((q) => q.belongs_to === 'ORDER' && !q.is_hidden);
    const productQuestions = questions.filter((q) => q.belongs_to === 'PRODUCT' && !q.is_hidden);

    return (
        <section className={classes.card} data-open={isOpen || undefined}>
            <button type="button" className={classes.previewToggle} aria-expanded={isOpen} onClick={() => setIsOpen(!isOpen)}>
                <span className={classes.pastille}><IconEye size={20} stroke={1.75}/></span>
                <span className={classes.previewToggleText}>
                    <span className={classes.cardTitle}>{t`Preview checkout form`}</span>
                    <span className={classes.cardSubtitle}>{t`What buyers fill in, question by question.`}</span>
                </span>
                <IconChevronDown className={classes.chevron} size={20} stroke={2}/>
            </button>

            <Collapse in={isOpen}>
                <div className={classes.previewContent} data-dehors-apercu>
                    <div className={classes.previewPane}>
                        <p className={classes.overline}>{t`Order`}</p>
                        <DefaultFields/>
                        {orderQuestions.map((q) => (
                            <QuestionInput key={q.id} question={q} name={String(q.id)} form={form}/>
                        ))}
                    </div>
                    <div className={classes.previewPane}>
                        <p className={classes.overline}>{t`Per Attendee`}</p>
                        {!isPerOrderCollection && <DefaultFields/>}
                        {productQuestions.map((q) => (
                            <QuestionInput key={q.id} question={q} name={String(q.id)} form={form}/>
                        ))}
                        {productQuestions.length === 0 && isPerOrderCollection && (
                            <p className={classes.emptyHint}>{t`Attendee details copied from order`}</p>
                        )}
                    </div>
                </div>
            </Collapse>
        </section>
    );
};

/**
 * « Questions d'inscription »: how the attendees' details are collected, the custom questions of the
 * order and of each attendee (drag to reorder), and a preview of the checkout form.
 */
export const QuestionsTable = ({questions}: QuestionsTableProp) => {
    const {eventId} = useParams();
    const [activeTab, setActiveTab] = useState<QuestionBelongsTo>('ORDER');
    const [createModalOpen, {open: openCreateModal, close: closeCreateModal}] = useDisclosure(false);
    const [editModalOpen, {open: openEditModal, close: closeEditModal}] = useDisclosure(false);
    const [questionId, setQuestionId] = useState<IdParam>();
    const {startExport, isExporting} = useExportAnswers(eventId);

    const eventSettingsQuery = useGetEventSettings(eventId);
    const updateSettingsMutation = useUpdateEventSettings();
    const addParticipantFormMutation = useAddParticipantForm();
    const collectionMethod = eventSettingsQuery.data?.attendee_details_collection_method || 'PER_TICKET';
    const isPerOrderCollection = collectionMethod === 'PER_ORDER';

    const orderQuestions = questions.filter((q) => q.belongs_to === 'ORDER');
    const productQuestions = questions.filter((q) => q.belongs_to === 'PRODUCT');
    const activeQuestions = activeTab === 'ORDER' ? orderQuestions : productQuestions;

    const edit = (id: IdParam) => {
        setQuestionId(id);
        openEditModal();
    };

    // Date of birth, emergency contact and health, asked of every attendee: shown on the attendee tab.
    const addParticipantForm = () => addParticipantFormMutation.mutate({eventId}, {
        onSuccess: ({data}) => {
            setActiveTab('PRODUCT');
            showSuccess(data.length > 0 ? t`Participant form added` : t`The participant form is already there`);
        },
        onError: (error: any) => showError(error?.response?.data?.message || t`Failed to add the participant form`),
    });

    const changeCollectionMethod = (value: 'PER_TICKET' | 'PER_ORDER') => updateSettingsMutation.mutate({
        eventSettings: {attendee_details_collection_method: value},
        eventId,
    }, {
        onSuccess: () => showSuccess(t`Setting updated`),
        onError: () => showError(t`Failed to update setting`),
    });

    return (
        <div className={classes.container}>
            <PageTitle
                subheading={t`Customize the questions asked during checkout to gather important information from your attendees.`}
                actions={(
                    <>
                        <Button variant="outline" leftSection={<IconTableExport size={20}/>} loading={isExporting} onClick={() => startExport()}>
                            {t`Export Answers`}
                        </Button>
                        <Button leftSection={<IconPlus size={20}/>} onClick={openCreateModal}>
                            {t`Add Question`}
                        </Button>
                    </>
                )}
            >
                {t`Registration Questions`}
            </PageTitle>

            <div className={classes.grid}>
                <section className={classes.card}>
                    <div className={classes.cardHead}>
                        <h2 className={classes.cardTitle}>{t`Attendee Information`}</h2>
                        <p className={classes.cardSubtitle}>{t`Name and email of each attendee, or the buyer's for everyone.`}</p>
                    </div>
                    <PillChoice
                        label={t`Attendee Information`}
                        value={collectionMethod}
                        disabled={updateSettingsMutation.isPending || !eventSettingsQuery.data}
                        options={[
                            {value: 'PER_TICKET', label: t`Per ticket`},
                            {value: 'PER_ORDER', label: t`Per order`},
                        ]}
                        onChange={changeCollectionMethod}
                    />
                    <p className={classes.hint}>
                        {isPerOrderCollection ? t`Use the buyer's details for all attendees` : t`Ask for name and email for each ticket purchased`}
                    </p>
                </section>

                <section className={classes.card}>
                    <div className={classes.cardHead}>
                        <h2 className={classes.cardTitle}>{t`Participant form`}</h2>
                        <p className={classes.cardSubtitle}>
                            {t`Date of birth, emergency contact and health, asked of each attendee. The answers are erased 30 days after the event.`}
                        </p>
                    </div>
                    <Button
                        variant="transparent"
                        className={classes.outlineButton}
                        leftSection={<IconFirstAidKit size={18}/>}
                        loading={addParticipantFormMutation.isPending}
                        onClick={addParticipantForm}
                    >
                        {t`Add the participant form`}
                    </Button>
                </section>
            </div>

            <section className={classes.card}>
                <div className={classes.questionsHead}>
                    <div className={classes.cardHead}>
                        <h2 className={classes.cardTitle}>{t`Custom Questions`}</h2>
                        <p className={classes.cardSubtitle}>{t`Drag the questions to change their order.`}</p>
                    </div>
                    <FilterChips<QuestionBelongsTo>
                        label={t`Custom Questions`}
                        value={activeTab}
                        onChange={setActiveTab}
                        chips={[
                            {value: 'ORDER', label: t`Order`, count: orderQuestions.length},
                            {value: 'PRODUCT', label: t`Attendee`, count: productQuestions.length},
                        ]}
                    />
                </div>
                <p className={classes.hint}>
                    {activeTab === 'ORDER'
                        ? t`Asked once, of the buyer.`
                        : t`Asked of each attendee.`}
                </p>

                <QuestionsList
                    key={activeTab}
                    questions={activeQuestions}
                    onEdit={edit}
                    onAdd={openCreateModal}
                    emptyMessage={activeTab === 'ORDER' ? t`No order questions yet` : t`No attendee questions yet`}
                    emptyHint={activeTab === 'ORDER'
                        ? t`Examples: "How did you hear about us?", "Company name for invoice"`
                        : t`Examples: "T-shirt size", "Meal preference", "Job title"`}
                />
            </section>

            <FormPreview questions={questions} isPerOrderCollection={isPerOrderCollection}/>

            {createModalOpen && (
                <CreateQuestionModal onCompleted={() => void 0} onClose={closeCreateModal} defaultBelongsTo={activeTab}/>
            )}
            {editModalOpen && questionId && (
                <EditQuestionModal questionId={questionId} onClose={closeEditModal}/>
            )}
        </div>
    );
};
