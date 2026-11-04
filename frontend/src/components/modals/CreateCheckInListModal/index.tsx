import {CheckInListRequest, GenericModalProps, Product, ProductCategory} from "../../../types.ts";
import {DehorsPopup} from "../../common/DehorsPopup";
import {t} from "@lingui/macro";
import {CheckInListForm, ticketIds} from "../../forms/CheckInListForm";
import formClasses from "../../forms/CheckInListForm/CheckInListForm.module.scss";
import {useForm} from "@mantine/form";
import {Button} from "@mantine/core";
import {useCreateCheckInList} from "../../../mutations/useCreateCheckInList.ts";
import {useParams} from "react-router";
import {useFormErrorResponseHandler} from "../../../hooks/useFormErrorResponseHandler.tsx";
import {useGetEvent} from "../../../queries/useGetEvent.ts";
import {NoResultsSplash} from "../../common/NoResultsSplash";
import {IconPlus} from "@tabler/icons-react";
import {useEffect} from "react";
import {showSuccess} from "../../../utilites/notifications.tsx";

export const CreateCheckInListModal = ({onClose}: GenericModalProps) => {
    const {eventId} = useParams();
    const errorHandler = useFormErrorResponseHandler();
    const {data: event} = useGetEvent(eventId);
    const form = useForm<CheckInListRequest>({
        initialValues: {
            name: '',
            description: '',
            expires_at: '',
            activates_at: '',
            pin: '',
            allow_door_sales: false,
            product_ids: [],
        }
    });

    // Every ticket is accepted to start with: it's the usual « Entrée principale ».
    useEffect(() => {
        if (event?.product_categories && !form.values.product_ids.length) {
            form.setFieldValue('product_ids', ticketIds(event.product_categories as ProductCategory[]));
        }
    }, [event?.id]);

    const createMutation = useCreateCheckInList();
    const eventHasTickets = event?.product_categories
        && event.product_categories.some(category => category.products.length > 0)
        && event.product_categories.filter(category =>
            category?.products?.filter((product: Product) => product.product_type === 'TICKET').length > 0).length > 0

    const handleSubmit = (requestData: CheckInListRequest) => {
        createMutation.mutate({
            eventId: eventId,
            checkInListData: requestData,
        }, {
            onSuccess: () => {
                showSuccess(t`The list is created. Open the scanner or copy its link from its card.`);
                onClose();
            },
            onError: (error) => errorHandler(form, error),
        })
    }

    const NoProducts = () => {
        return (
            <NoResultsSplash
                imageHref={'/blank-slate/tickets.svg'}
                heading={t`Please create a ticket`}
                subHeading={(
                    <>
                        <p>
                            {t`You'll need a ticket before you can create a check-in list.`}
                        </p>
                        <Button
                            size={'xs'}
                            leftSection={<IconPlus/>}
                            color={'green'}
                            onClick={() => window.location.href = `/manage/event/${eventId}/products/#create-product`}
                        >
                            {t`Create a Ticket`}
                        </Button>
                    </>
                )}
            />
        );
    }

    return (
        <DehorsPopup onClose={onClose} title={eventHasTickets ? t`New entry list` : t`Please create a ticket`}>
            {!eventHasTickets && <NoProducts/>}
            {eventHasTickets && (
                <form onSubmit={form.onSubmit(handleSubmit)} className={formClasses.form}>
                    {event && (
                        <CheckInListForm
                            form={form}
                            productCategories={event.product_categories as ProductCategory[]}
                        />
                    )}
                    <div className={formClasses.actions}>
                        <Button type="submit" loading={createMutation.isPending}>{t`Create the list`}</Button>
                    </div>
                </form>
            )}
        </DehorsPopup>
    );
}
