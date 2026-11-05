import {t} from "@lingui/macro";
import {useState} from "react";
import {Select} from "@mantine/core";
import {Modal} from "../../../common/Modal";
import {SendMessageModal} from "../../../modals/SendMessageModal";
import {useGetOrganizerEvents} from "../../../../queries/useGetOrganizerEvents.ts";
import {IdParam, MessageType} from "../../../../types.ts";
import {prettyDate} from "../../../../utilites/dates.ts";

// A message always belongs to an event: pick it first, then the same window as on the event's
// Messages page opens. With a single event, it is picked already.
export const ComposeMessage = ({organizerId, onClose}: { organizerId: IdParam, onClose: () => void }) => {
    const [pickedEventId, setPickedEventId] = useState<string | null>(null);
    const {data, isLoading} = useGetOrganizerEvents(organizerId, {
        perPage: 100,
        sortBy: 'start_date',
        sortDirection: 'desc',
    });
    const events = data?.data ?? [];
    const eventId = pickedEventId ?? (events.length === 1 ? String(events[0].id) : null);

    if (eventId) {
        return <SendMessageModal eventId={eventId} messageType={MessageType.OrderOwner} onClose={onClose}/>;
    }

    return (
        <Modal opened withCloseButton onClose={onClose} heading={t`New message`}>
            <Select
                label={t`Event`}
                description={t`The message goes to the attendees of this event.`}
                placeholder={t`Choose an event`}
                data={events.map(event => ({
                    value: String(event.id),
                    label: `${event.title} · ${prettyDate(event.start_date, event.timezone)}`,
                }))}
                disabled={isLoading}
                searchable
                nothingFoundMessage={t`No events found`}
                onChange={setPickedEventId}
            />
        </Modal>
    );
};
