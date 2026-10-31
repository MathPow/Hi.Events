import {useParams} from "react-router";
import {useGetOrderPublic} from "../../../../queries/useGetOrderPublic.ts";
import {PrintTickets} from "./PrintTickets.tsx";

// Les billets d'une commande (« Telecharger les billets » de la confirmation).
export const PrintOrder = () => {
    const {eventId, orderShortId} = useParams();
    const {data: order} = useGetOrderPublic(eventId, orderShortId, ['event']);
    const event = order?.event;

    if (!order || !event) {
        return null;
    }

    return <PrintTickets event={event} attendees={order.attendees ?? []} orderPublicId={order.public_id}/>;
}

export default PrintOrder;
