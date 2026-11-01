import {useRef} from "react";
import {useForm} from "@mantine/form";
import {useSectionAutosave} from "../../../layouts/AppLayout/PageStatus.tsx";
import {showServerErrors} from "../../organizer/Settings/SettingsUi.tsx";
import {isEmptyHtml} from "../../../../utilites/helpers.ts";

interface AutosaveFormOptions<T> {
    // A section of the page: its changes leave together, one request at a time.
    key: string;
    initialValues: T;
    // changes: the fields left since the last save; values: the whole form as it is now.
    save: (changes: Partial<T>, values: T) => Promise<unknown>;
    // Fields written with the editor: an empty paragraph is an empty text.
    html?: (keyof T)[];
}

/**
 * A card of « Paramètres de l'événement » whose fields save themselves, like the organizer's
 * Paramètres: a text when it is left, a switch or a choice right away (« Changements enregistrés »
 * in the top bar). The form starts from the saved values once; refetches don't overwrite what is
 * being typed.
 */
export const useAutosaveForm = <T extends Record<string, any>>({key, initialValues, save, html = []}: AutosaveFormOptions<T>) => {
    const form = useForm<T>({initialValues});
    const saved = useRef<T>(initialValues);
    const latest = useRef<T>(form.values);
    latest.current = form.values;

    const normalized = (field: keyof T, value: unknown) => {
        if (value === null || value === undefined) {
            return '';
        }
        if (typeof value !== 'string') {
            return value;
        }
        return html.includes(field) && isEmptyHtml(value) ? '' : value.trim();
    };

    const isSaved = (field: keyof T, value: unknown) =>
        JSON.stringify(normalized(field, value)) === JSON.stringify(normalized(field, saved.current[field]));

    const queue = useSectionAutosave<T>(key, (changes) => save(changes, latest.current), {
        onSaved: (changes) => {
            const fields = Object.keys(changes);
            saved.current = {...saved.current, ...changes};
            // « location_details.city » belongs to the field « city ».
            Object.keys(form.errors)
                .filter(error => fields.some(field => error === field || error.startsWith(`${field}.`) || error.endsWith(`.${field}`)))
                .forEach(error => form.clearFieldError(error));
        },
        onFailed: (error) => showServerErrors(form, error),
    });

    // Saves these fields, together, when one of them changed. values: what was just chosen, not yet
    // in the form.
    const commit = (fields: keyof T | (keyof T)[], values: Partial<T> = {}) => {
        const list = Array.isArray(fields) ? fields : [fields];
        const current = {...latest.current, ...values};
        if (list.some(field => !isSaved(field, current[field]))) {
            queue(Object.fromEntries(list.map(field => [field, current[field]])) as Partial<T>);
        }
    };

    // A switch, a pill or a select: in the form and saved right away (with its group, if any).
    const choose = <K extends keyof T>(field: K, value: T[K], group?: (keyof T)[]) => {
        form.setFieldValue(field as any, value as any);
        commit(group ?? field, {[field]: value} as unknown as Partial<T>);
    };

    // A group of fields saved together once the focus leaves all of them (an address, a button and its link).
    const groupBlur = (fields: (keyof T)[]) => (event: { currentTarget: HTMLElement, relatedTarget: EventTarget | null }) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            commit(fields);
        }
    };

    return {form, commit, choose, groupBlur, latest};
};

// The editor's empty paragraph is saved as nothing.
export const htmlOrNull = (value: string | null | undefined) => !value || isEmptyHtml(value) ? null : value;
