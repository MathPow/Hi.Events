import {useState} from "react";
import {t} from "@lingui/macro";
import {Link} from "react-router";
import {Button, Checkbox, Textarea} from "@mantine/core";
import {useForm} from "@mantine/form";
import {IconBroadcast} from "@tabler/icons-react";
import {IdParam} from "../../../../types.ts";
import {LIVE_TRACK_GUIDE_PATH, LiveTrackPublic} from "../../../../api/liveTrack.client.ts";
import {useGetAttendeeLiveTrackPublic} from "../../../../queries/useGetAttendeeLiveTrackPublic.ts";
import {useRemoveLiveTrack, useShareLiveTrack} from "../../../../mutations/useAttendeeLiveTrackMutations.ts";
import {useFormErrorResponseHandler} from "../../../../hooks/useFormErrorResponseHandler.tsx";
import {showError, showSuccess} from "../../../../utilites/notifications.tsx";
import {relativeDate} from "../../../../utilites/dates.ts";
import {formatKm} from "../../../common/CourseMap/courseFormat.ts";
import print from "../PrintOrder/PrintOrder.module.scss";
import classes from './AttendeeProductAndInformation.module.scss';

interface ShareForm {
    link: string;
    consent: boolean;
}

const statusLine = (liveTrack: LiveTrackPublic): string => {
    switch (liveTrack.status) {
        case 'ACTIVE': {
            const ago = liveTrack.last_point_at ? relativeDate(liveTrack.last_point_at) : '';
            const distance = liveTrack.distance_m ? formatKm(liveTrack.distance_m) : '';
            return distance
                ? t`The organization sees you on the course: ${distance} covered, last position ${ago}.`
                : t`The organization sees you on the course: last position ${ago}.`;
        }
        case 'ENDED':
            return t`Your activity has ended. The organization no longer follows you.`;
        case 'FAILED':
            return liveTrack.last_error ?? t`Garmin no longer knows this link. Share the link of your new activity.`;
        default:
            return t`Link received. The organization will see you as soon as your activity starts on your watch.`;
    }
};

/**
 * « Suivi en direct » under the ticket, when the organizer offers it: the participant pastes the
 * link of their Garmin LiveTrack so the organization sees where they are on the course.
 */
export const LiveTrackCard = ({eventId, attendeeShortId}: { eventId: IdParam, attendeeShortId: string }) => {
    const {data} = useGetAttendeeLiveTrackPublic(eventId, attendeeShortId);
    const share = useShareLiveTrack(eventId, attendeeShortId);
    const remove = useRemoveLiveTrack(eventId, attendeeShortId);
    const errorHandler = useFormErrorResponseHandler();
    const [editing, setEditing] = useState(false);
    const form = useForm<ShareForm>({
        initialValues: {link: '', consent: false},
        validate: {
            link: (value) => value.trim() === '' ? t`Paste your LiveTrack link.` : null,
            consent: (value) => value ? null : t`Accept that the organizer sees your position to share it.`,
        },
    });

    if (!data?.enabled) {
        return null;
    }

    const liveTrack = data.live_track;
    const showForm = !liveTrack || editing;

    const submit = (values: ShareForm) => share.mutate(values, {
        onSuccess: () => {
            showSuccess(t`Your LiveTrack link is shared with the organization.`);
            setEditing(false);
            form.reset();
        },
        onError: (error) => errorHandler(form, error),
    });

    const stop = () => remove.mutate(undefined, {
        onSuccess: () => showSuccess(t`You no longer share your position.`),
        onError: () => showError(t`Something went wrong. Please try again.`),
    });

    return (
        <section id="suivi-en-direct" className={`${classes.routeCard} ${print.screenOnly}`} data-rough>
            <h2 className={classes.routeTitle}>{t`Live tracking`}</h2>
            <p className={classes.routeIntro}>
                {t`Share your Garmin LiveTrack: the organization sees where you are on the course during the event, for your safety.`}
            </p>

            {liveTrack && (
                <p className={classes.liveStatus} data-status={liveTrack.status}>
                    <IconBroadcast size={18} stroke={1.75} aria-hidden/>
                    <span>{statusLine(liveTrack)}</span>
                </p>
            )}

            {showForm ? (
                <form onSubmit={form.onSubmit(submit)} className={classes.liveForm}>
                    <p className={classes.liveHelp}>
                        <Link to={LIVE_TRACK_GUIDE_PATH} target="_blank">{t`How to start LiveTrack and copy the link (2 min)`}</Link>
                    </p>
                    <Textarea
                        label={t`Your LiveTrack link`}
                        placeholder="https://livetrack.garmin.com/session/…/token/…"
                        description={t`You can also paste the whole email Garmin sent you.`}
                        autosize
                        minRows={2}
                        maxRows={5}
                        {...form.getInputProps('link')}
                    />
                    <Checkbox
                        label={t`I agree that the organizer sees my position and my watch's figures (pace, heart rate) during the event. They are deleted after 14 days.`}
                        {...form.getInputProps('consent', {type: 'checkbox'})}
                    />
                    <div className={classes.liveButtons}>
                        <Button type="submit" loading={share.isPending}>{t`Share my position`}</Button>
                        {editing && (
                            <Button variant="subtle" onClick={() => setEditing(false)}>{t`Cancel`}</Button>
                        )}
                    </div>
                </form>
            ) : (
                <div className={classes.liveButtons}>
                    <Button variant="outline" onClick={() => setEditing(true)}>{t`Share a new link`}</Button>
                    <Button variant="subtle" loading={remove.isPending} onClick={stop}>{t`Stop sharing`}</Button>
                </div>
            )}
        </section>
    );
};
