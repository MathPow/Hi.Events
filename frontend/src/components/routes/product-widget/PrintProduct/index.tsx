import {useParams} from 'react-router';
import {useGetEventPublic} from '../../../../queries/useGetEventPublic.ts';
import {useGetAttendeePublic} from '../../../../queries/useGetAttendeePublic.ts';
import {Attendee} from '../../../../types.ts';
import {PrintTickets} from "../PrintOrder/PrintTickets.tsx";

// Un seul billet, la meme page que ceux d'une commande.
const PrintProduct = () => {
    const {eventId, attendeeShortId} = useParams();
    const {data: event} = useGetEventPublic(eventId);
    const {data: attendee} = useGetAttendeePublic(eventId, String(attendeeShortId));

    if (!event || !attendee) {
        return null;
    }

    return <PrintTickets event={event} attendees={[attendee as Attendee]}/>;
}

export default PrintProduct;
