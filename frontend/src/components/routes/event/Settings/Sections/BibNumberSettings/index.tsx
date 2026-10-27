import {t} from "@lingui/macro";
import {Button, NumberInput, Text} from "@mantine/core";
import {useForm} from "@mantine/form";
import {useParams} from "react-router";
import {useEffect, useMemo} from "react";
import {Card} from "../../../../../common/Card";
import {HeadingWithDescription} from "../../../../../common/Card/CardHeading";
import {showError, showSuccess} from "../../../../../../utilites/notifications.tsx";
import {useFormErrorResponseHandler} from "../../../../../../hooks/useFormErrorResponseHandler.tsx";
import {useGetEventProductCategories} from "../../../../../../queries/useGetProductCategories.ts";
import {useUpdateBibNumberStarts} from "../../../../../../mutations/useUpdateBibNumberStarts.ts";
import {useAssignBibNumbers} from "../../../../../../mutations/useAssignBibNumbers.ts";
import {ProductType} from "../../../../../../types.ts";
import classes from "./BibNumberSettings.module.scss";

interface BibNumberRow {
    product_price_id: number;
    label: string;
    bib_number_start: number | string;
}

/**
 * The first bib number of each ticket option (a distance, a category): every
 * confirmed attendee of that option gets the next number.
 */
export const BibNumberSettings = () => {
    const {eventId} = useParams();
    const categoriesQuery = useGetEventProductCategories(eventId);
    const updateMutation = useUpdateBibNumberStarts();
    const assignMutation = useAssignBibNumbers();
    const formErrorHandle = useFormErrorResponseHandler();
    const form = useForm<{ starts: BibNumberRow[] }>({
        initialValues: {starts: []},
    });

    const rows = useMemo(() => (categoriesQuery.data?.data || [])
        .flatMap((category) => category.products || [])
        .filter((product) => product.product_type === ProductType.Ticket)
        .flatMap((product) => (product.prices || []).map((price) => ({
            product_price_id: price.id as number,
            label: (product.prices || []).length > 1 && price.label
                ? `${product.title} · ${price.label}`
                : product.title,
            bib_number_start: price.bib_number_start ?? '',
        }))), [categoriesQuery.data]);

    useEffect(() => {
        form.setValues({starts: rows});
    }, [rows]);

    const handleSubmit = (values: typeof form.values) => {
        updateMutation.mutate({
            eventId,
            starts: values.starts.map((row) => ({
                product_price_id: row.product_price_id,
                bib_number_start: row.bib_number_start === '' ? null : Number(row.bib_number_start),
            })),
        }, {
            onSuccess: () => showSuccess(t`Successfully Updated Settings`),
            onError: (error) => formErrorHandle(form, error),
        });
    };

    const handleAssign = () => {
        assignMutation.mutate({eventId}, {
            onSuccess: ({data}) => showSuccess(t`Bib numbers given: ${data.assigned}`),
            onError: () => showError(t`Could not give the bib numbers. Please try again.`),
        });
    };

    return (
        <Card>
            <HeadingWithDescription
                heading={t`Bib numbers`}
                description={t`Give a ticket option its first number and each confirmed attendee of that option gets the next one. It shows on their ticket, in the attendee list and at check-in. Leave empty for no bibs.`}
            />

            {categoriesQuery.isFetched && rows.length === 0 && (
                <Text c="dimmed" size="sm">{t`Add a ticket to give bib numbers.`}</Text>
            )}

            {rows.length > 0 && (
                <form onSubmit={form.onSubmit(handleSubmit)}>
                    <fieldset disabled={updateMutation.isPending}>
                        <div className={classes.rows}>
                            {form.values.starts.map((row, index) => (
                                <div className={classes.row} key={row.product_price_id}>
                                    <Text className={classes.label}>{row.label}</Text>
                                    <NumberInput
                                        {...form.getInputProps(`starts.${index}.bib_number_start`)}
                                        className={classes.input}
                                        aria-label={t`First bib number for ${row.label}`}
                                        placeholder={t`No bibs`}
                                        allowDecimal={false}
                                        allowNegative={false}
                                        min={1}
                                        max={999999}
                                    />
                                </div>
                            ))}
                        </div>

                        <Button loading={updateMutation.isPending} type="submit" mt="xl">
                            {t`Save`}
                        </Button>
                    </fieldset>

                    <div className={classes.assign}>
                        <Text size="sm" c="dimmed" className={classes.assignText}>
                            {t`Attendees who registered before you set the first numbers have no bib yet.`}
                        </Text>
                        <Button variant="light" className={classes.assignButton} onClick={handleAssign}
                                loading={assignMutation.isPending}>
                            {t`Number existing attendees`}
                        </Button>
                    </div>
                </form>
            )}
        </Card>
    );
};
