import {t} from "@lingui/macro";
import {Button, Collapse, Textarea, TextInput} from "@mantine/core";
import {DraftFaq, newFaqKey} from "./homepageDraft.ts";
import {SortableRow, SortableRows} from "./SortableRows.tsx";
import classes from "./OrganizerHomepageDesigner.module.scss";

const MAX_FAQS = 50;

interface FaqSectionProps {
    faqs: DraftFaq[];
    onChange: (faqs: DraftFaq[]) => void;
    // The question being edited (opened by its pencil, or by publishing with an unfinished one).
    editing: string | null;
    onEdit: (key: string | null) => void;
    // Errors are shown once publishing was tried with an unfinished question.
    showErrors: boolean;
    disabled?: boolean;
}

// The questions shown at the bottom of the public page (formerly the separate FAQ page).
export const FaqSection = ({faqs, onChange, editing, onEdit, showErrors, disabled}: FaqSectionProps) => {
    const update = (key: string, values: Partial<DraftFaq>) =>
        onChange(faqs.map(faq => faq.key === key ? {...faq, ...values} : faq));

    const add = () => {
        const key = newFaqKey();
        onChange([...faqs, {key, question: '', answer: ''}]);
        onEdit(key);
    };

    const remove = (key: string) => {
        onChange(faqs.filter(faq => faq.key !== key));
        onEdit(null);
    };

    return (
        <>
            {faqs.length === 0 && (
                <p className={classes.empty}>
                    {t`No questions yet. The FAQ section stays hidden on your homepage until you add one.`}
                </p>
            )}

            {faqs.length > 0 && (
                <SortableRows items={faqs} getId={faq => faq.key} onReorder={onChange}>
                    {(faq) => {
                        const isEditing = editing === faq.key;
                        const isNew = faq.key.startsWith('new-');
                        return (
                            <SortableRow key={faq.key} id={faq.key} gripSize={16} className={classes.faqRow}>
                                {(grip) => (
                                    <>
                                        <div className={classes.rowMain}>
                                            {grip}
                                            <span className={classes.faqQuestion}>
                                                {faq.question.trim() || t`New question`}
                                            </span>
                                            <button
                                                type="button"
                                                className={classes.iconButton}
                                                aria-label={t`Edit`}
                                                aria-expanded={isEditing}
                                                onClick={() => onEdit(isEditing ? null : faq.key)}
                                            >
                                                <img src="/interface/admin/ma-page/pen.svg" alt=""/>
                                            </button>
                                        </div>
                                        <Collapse in={isEditing}>
                                            <div className={classes.rowEdit}>
                                                <TextInput
                                                    className={classes.field}
                                                    label={t`Question`}
                                                    placeholder={t`Is there parking on site?`}
                                                    value={faq.question}
                                                    maxLength={255}
                                                    disabled={disabled}
                                                    autoFocus={isEditing && isNew && !faq.question}
                                                    error={showErrors && !faq.question.trim() ? t`Question is required` : undefined}
                                                    onChange={(event) => update(faq.key, {question: event.currentTarget.value})}
                                                />
                                                <Textarea
                                                    className={classes.field}
                                                    label={t`Answer`}
                                                    placeholder={t`Yes, free parking is available next to the entrance.`}
                                                    value={faq.answer}
                                                    maxLength={5000}
                                                    autosize
                                                    minRows={3}
                                                    disabled={disabled}
                                                    error={showErrors && !faq.answer.trim() ? t`Answer is required` : undefined}
                                                    onChange={(event) => update(faq.key, {answer: event.currentTarget.value})}
                                                />
                                                <div className={classes.rowEditActions}>
                                                    <button
                                                        type="button"
                                                        className={`${classes.textButton} ${classes.removeButton}`}
                                                        disabled={disabled}
                                                        onClick={() => remove(faq.key)}
                                                    >
                                                        {t`Delete`}
                                                    </button>
                                                    <Button className={classes.doneButton} onClick={() => onEdit(null)}>
                                                        {t`Done`}
                                                    </Button>
                                                </div>
                                            </div>
                                        </Collapse>
                                    </>
                                )}
                            </SortableRow>
                        );
                    }}
                </SortableRows>
            )}

            {faqs.length < MAX_FAQS && (
                <button type="button" className={classes.textButton} disabled={disabled} onClick={add}>
                    <img src="/interface/admin/ma-page/plus-accent.svg" alt=""/>
                    {t`Add a question`}
                </button>
            )}
        </>
    );
};
