import {useEffect, useMemo, useRef, useState} from "react";
import {t} from "@lingui/macro";
import {Button, NumberInput, Skeleton} from "@mantine/core";
import {IdParam, ProductType} from "../../../../../types.ts";
import {useGetEventProductCategories} from "../../../../../queries/useGetProductCategories.ts";
import {useUpdateBibNumberStarts} from "../../../../../mutations/useUpdateBibNumberStarts.ts";
import {useAssignBibNumbers} from "../../../../../mutations/useAssignBibNumbers.ts";
import {showError, showSuccess} from "../../../../../utilites/notifications.tsx";
import {useSectionAutosave} from "../../../../layouts/AppLayout/PageStatus.tsx";
import {SettingsCard} from "../../../organizer/Settings/SettingsUi.tsx";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

type Starts = Record<number, number | string>;

/**
 * « Dossards »: the first bib number of each ticket option (a distance, a category); every confirmed
 * attendee of that option gets the next number. All the numbers leave together when one is left.
 */
export const BibNumbersCard = ({eventId}: { eventId: IdParam }) => {
    const categoriesQuery = useGetEventProductCategories(eventId);
    const updateMutation = useUpdateBibNumberStarts();
    const assignMutation = useAssignBibNumbers();
    const [starts, setStarts] = useState<Starts | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const saved = useRef<Starts>({});
    const latest = useRef<Starts | null>(starts);
    latest.current = starts;

    const rows = useMemo(() => (categoriesQuery.data?.data || [])
        .flatMap((category) => category.products || [])
        .filter((product) => product.product_type === ProductType.Ticket)
        .flatMap((product) => (product.prices || []).map((price) => ({
            id: price.id as number,
            label: (product.prices || []).length > 1 && price.label ? `${product.title} · ${price.label}` : product.title,
            start: price.bib_number_start ?? '',
        }))), [categoriesQuery.data]);

    // The numbers start from the saved ones once; later refetches don't overwrite what is being typed.
    useEffect(() => {
        if (categoriesQuery.isFetched && starts === null) {
            const initial = Object.fromEntries(rows.map(row => [row.id, row.start]));
            saved.current = initial;
            setStarts(initial);
        }
    }, [categoriesQuery.isFetched, rows]);

    const queue = useSectionAutosave<Starts>('bib-numbers', () => updateMutation.mutateAsync({
        eventId,
        starts: Object.entries(latest.current ?? {}).map(([id, start]) => ({
            product_price_id: Number(id),
            bib_number_start: start === '' ? null : Number(start),
        })),
    }), {
        onSaved: (changes) => {
            saved.current = {...saved.current, ...changes} as Starts;
            setErrors({});
        },
        onFailed: (error: any) => {
            const serverErrors = error?.response?.data?.errors as Record<string, string[]> | undefined;
            setErrors(Object.fromEntries(Object.entries(serverErrors ?? {}).map(([key, messages]) => [key, messages[0]])));
        },
    });

    const commit = (id: number) => {
        const value = latest.current?.[id] ?? '';
        if (String(value) !== String(saved.current[id] ?? '')) {
            queue({[id]: value});
        }
    };

    const assign = () => assignMutation.mutate({eventId}, {
        // eslint-disable-next-line lingui/no-expression-in-message
        onSuccess: ({data}) => showSuccess(t`Bib numbers given: ${data.assigned}`),
        onError: () => showError(t`Could not give the bib numbers. Please try again.`),
    });

    return (
        <SettingsCard
            id="bib-number-settings"
            className={extra.anchored}
            title={t`Bib numbers`}
            subtitle={t`Give a ticket option its first number and each confirmed attendee of that option gets the next one. It shows on their ticket, in the attendee list and at check-in. Leave empty for no bibs.`}
        >
            {starts === null && <Skeleton height={56} radius={18}/>}

            {starts !== null && rows.length === 0 && (
                <p className={classes.empty}>{t`Add a ticket to give bib numbers.`}</p>
            )}

            {starts !== null && rows.length > 0 && (
                <>
                    <div className={classes.list}>
                        {rows.map((row, index) => (
                            <div className={extra.bibRow} key={row.id}>
                                <span className={extra.bibLabel}>{row.label}</span>
                                <NumberInput
                                    className={extra.bibInput}
                                    // eslint-disable-next-line lingui/no-expression-in-message
                                    aria-label={t`First bib number for ${row.label}`}
                                    placeholder={t`No bibs`}
                                    allowDecimal={false}
                                    allowNegative={false}
                                    hideControls
                                    min={1}
                                    max={999999}
                                    value={starts[row.id] ?? ''}
                                    error={errors[`starts.${index}.bib_number_start`]}
                                    onChange={(value) => setStarts(current => ({...current, [row.id]: value}))}
                                    onBlur={() => commit(row.id)}
                                />
                            </div>
                        ))}
                    </div>

                    <div className={extra.footerRow}>
                        <p className={classes.softHint}>
                            {t`Attendees who registered before you set the first numbers have no bib yet.`}
                        </p>
                        <Button
                            variant="transparent"
                            className={classes.outlineButton}
                            onClick={assign}
                            loading={assignMutation.isPending}
                        >
                            {t`Number existing attendees`}
                        </Button>
                    </div>
                </>
            )}
        </SettingsCard>
    );
};
