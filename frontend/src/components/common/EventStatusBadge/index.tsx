import {Event} from "../../../types.ts";
import {t} from "@lingui/macro";
import {StatusTag} from "../StatusTag";

interface EventLifecycleStatusLabelProps {
    event: Event;
    showLifecycleStatus?: boolean;
}

export const EventStatusBadge = ({event, showLifecycleStatus = true}: EventLifecycleStatusLabelProps) => {
    const status = (() => {
        switch (event.status) {
            case 'LIVE':
                return t`Live`;
            case 'DRAFT':
                return t`Draft`;
            case 'ARCHIVED':
                return t`Archived`;
            default:
                return event.status;
        }
    })();

    const lifecycleStatus = (() => {
        switch (event.lifecycle_status) {
            case 'ENDED':
                return t`Ended`;
            case 'UPCOMING':
                return t`Upcoming`;
            case 'ONGOING':
                return t`Ongoing`;
            default:
                return undefined;
        }
    })();

    return (
        <StatusTag tone={event.status === 'LIVE' ? 'ok' : event.status === 'DRAFT' ? 'waiting' : 'neutral'}>
            {status}{showLifecycleStatus && lifecycleStatus && <> &bull; {lifecycleStatus}</>}
        </StatusTag>
    );
}
