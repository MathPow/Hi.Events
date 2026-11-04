import {useEffect, useMemo, useRef, useState} from "react";
import {t} from "@lingui/macro";
import {Button, NumberInput, Skeleton} from "@mantine/core";
import {IconCheck} from "@tabler/icons-react";
import {IdParam, ProductType} from "../../../../../types.ts";
import {useGetEventProductCategories} from "../../../../../queries/useGetProductCategories.ts";
import {useUpdateBibNumberStarts} from "../../../../../mutations/useUpdateBibNumberStarts.ts";
import {useAssignBibNumbers} from "../../../../../mutations/useAssignBibNumbers.ts";
import {showError, showSuccess} from "../../../../../utilites/notifications.tsx";
import {useSectionAutosave} from "../../../../layouts/AppLayout/PageStatus.tsx";
import {SettingsCard, ToggleRow} from "../../../organizer/Settings/SettingsUi.tsx";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

type Starts = Record<number, number | null>;

const DEFAULT_FIRST = 1;

/**
 * « Dossards »: a switch, the first number and the tickets concerned. The server keeps a first number
 * per ticket option and never gives a number twice in an event, so the same first number on several
 * options makes one sequence. Options numbered separately before keep their numbers until the first
 * number is changed here.
 */
export const BibNumbersCard = ({eventId}: { eventId: IdParam }) => {
    const categoriesQuery = useGetEventProductCategories(eventId);
    const updateMutation = useUpdateBibNumberStarts();
    const assignMutation = useAssignBibNumbers();
    const [starts, setStarts] = useState<Starts | null>(null);
    const [enabled, setEnabled] = useState(false);
    const [first, setFirst] = useState<number | string>(DEFAULT_FIRST);
    const [error, setError] = useState<string | undefined>();
    const latest = useRef<Starts | null>(starts);
    latest.current = starts;

    const rows = useMemo(() => (categoriesQuery.data?.data || [])
        .flatMap((category) => category.products || [])
        .filter((product) => product.product_type === ProductType.Ticket)
        .flatMap((product) => (product.prices || []).map((price) => ({
            id: price.id as number,
            label: (product.prices || []).length > 1 && price.label ? `${product.title} · ${price.label}` : product.title,
            start: price.bib_number_start ?? null,
        }))), [categoriesQuery.data]);

    // The numbers start from the saved ones once; later refetches don't overwrite what is being typed.
    useEffect(() => {
        if (!categoriesQuery.isFetched || starts !== null) {
            return;
        }
        const initial = Object.fromEntries(rows.map(row => [row.id, row.start]));
        const numbers = rows.flatMap(row => row.start === null ? [] : [row.start]);
        setStarts(initial);
        setEnabled(numbers.length > 0);
        setFirst(numbers.length > 0 ? Math.min(...numbers) : DEFAULT_FIRST);
    }, [categoriesQuery.isFetched, rows]);

    const queue = useSectionAutosave<Starts>('bib-numbers', () => updateMutation.mutateAsync({
        eventId,
        starts: Object.entries(latest.current ?? {}).map(([id, start]) => ({
            product_price_id: Number(id),
            bib_number_start: start,
        })),
    }), {
        onSaved: () => setError(undefined),
        onFailed: (failure: any) => {
            const messages = Object.values(failure?.response?.data?.errors ?? {}) as string[][];
            setError(messages[0]?.[0]);
        },
    });

    const save = (next: Starts) => {
        latest.current = next;
        setStarts(next);
        queue(next);
    };

    const firstNumber = () => Number(first) >= 1 ? Number(first) : DEFAULT_FIRST;

    const toggle = (checked: boolean) => {
        setEnabled(checked);
        save(Object.fromEntries(rows.map(row => [row.id, checked ? firstNumber() : null])));
    };

    const toggleTicket = (id: number) => save({...starts, [id]: starts?.[id] == null ? firstNumber() : null});

    // A new first number applies to every ticket concerned.
    const commitFirst = () => {
        if (!starts || first === '') {
            return;
        }
        const next = Object.fromEntries(Object.entries(starts).map(([id, start]) => [id, start === null ? null : firstNumber()]));
        if (JSON.stringify(next) !== JSON.stringify(starts)) {
            save(next);
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
            subtitle={t`One number per attendee, on their ticket and in the scanner.`}
        >
            {starts === null && <Skeleton height={56} radius={18}/>}

            {starts !== null && rows.length === 0 && (
                <p className={classes.empty}>{t`Add a ticket to give bib numbers.`}</p>
            )}

            {starts !== null && rows.length > 0 && (
                <>
                    <ToggleRow
                        label={t`Assign bib numbers`}
                        hint={t`Each confirmed attendee gets the next number.`}
                        checked={enabled}
                        onChange={toggle}
                    />

                    {enabled && (
                        <>
                            <NumberInput
                                className={`${classes.field} ${extra.bibFirst}`}
                                label={t`First number`}
                                allowDecimal={false}
                                allowNegative={false}
                                hideControls
                                min={1}
                                max={999999}
                                value={first}
                                error={error}
                                onChange={setFirst}
                                onBlur={commitFirst}
                            />

                            <div className={extra.fieldGroup}>
                                <p className={classes.fieldLabel}>{t`Tickets with a bib`}</p>
                                <div className={classes.pills} role="group" aria-label={t`Tickets with a bib`}>
                                    {rows.map(row => {
                                        const checked = starts[row.id] != null;
                                        return (
                                            <button
                                                key={row.id}
                                                type="button"
                                                role="checkbox"
                                                aria-checked={checked}
                                                className={classes.pill}
                                                onClick={() => toggleTicket(row.id)}
                                            >
                                                {checked && <IconCheck size={16} stroke={2.25}/>}
                                                {row.label}
                                            </button>
                                        );
                                    })}
                                </div>
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
                </>
            )}
        </SettingsCard>
    );
};
