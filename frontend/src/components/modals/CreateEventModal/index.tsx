import {useEffect, useRef} from "react";
import {useNavigate} from "react-router";
import {t} from "@lingui/macro";
import {Button, Drawer, Modal, Select, TextInput, UnstyledButton} from "@mantine/core";
import {hasLength, useForm} from "@mantine/form";
import {useMediaQuery} from "@mantine/hooks";
import {DateTimePicker} from "@mantine/dates";
import dayjs from "dayjs";
import classNames from "classnames";
import {useFormErrorResponseHandler} from "../../../hooks/useFormErrorResponseHandler.tsx";
import {useGetAccount} from "../../../queries/useGetAccount.ts";
import {useGetOrganizers} from "../../../queries/useGetOrganizers.ts";
import {useCreateEvent} from "../../../mutations/useCreateEvent.ts";
import {AccountEventType, Event, GenericModalProps, IdParam} from "../../../types.ts";
import {CATEGORY_OF_TYPE, EVENT_TYPES, eventTypeLabel} from "../../../constants/eventTypes.ts";
import {useLingui} from "@lingui/react";
import classes from "./CreateEventModal.module.scss";

interface CreateEventModalProps extends GenericModalProps {
    organizerId?: IdParam;
}

interface CreateEventFormValues {
    title: string;
    type: AccountEventType;
    start_date: string | null;
    end_date: string | null;
    location: string;
    organizer_id?: string;
}


// The coming Saturday, 9 to 12, like the example of the mockup.
const defaultStart = () => {
    const now = dayjs();
    const saturday = now.add(((6 - now.day()) + 7) % 7 || 7, 'day');
    return saturday.hour(9).minute(0).second(0).millisecond(0);
};

/**
 * Figma « Admin · Créer un événement (popup) » and, on phones, « (feuille) »: the basics to start a
 * draft (name, type, dates, place), then the event's page to complete the rest.
 */
export const CreateEventModal = ({onClose, organizerId}: CreateEventModalProps) => {
    // eslint-disable-next-line lingui/no-unlocalized-strings
    const isMobile = useMediaQuery('(max-width: 767px)');
    const errorHandler = useFormErrorResponseHandler();
    const navigate = useNavigate();
    const {data: account} = useGetAccount();
    const organizersQuery = useGetOrganizers();
    const organizers = organizersQuery.data?.data ?? [];
    const eventMutation = useCreateEvent();
    const {i18n} = useLingui();
    // « sam. 7 nov. 2026 · 9 h 00 » in French, like the mockup.
    const dateFormat = i18n.locale.startsWith('fr') ? 'ddd D MMM YYYY · H [h] mm' : 'ddd, MMM D, YYYY · h:mm A';
    // The account's first type is the default, until a type is picked.
    const typeChosen = useRef(false);

    const form = useForm<CreateEventFormValues>({
        initialValues: {
            title: '',
            type: account?.event_types?.[0] ?? 'SPORT',
            start_date: defaultStart().toISOString(),
            end_date: defaultStart().add(3, 'hour').toISOString(),
            location: '',
            organizer_id: organizerId ? String(organizerId) : undefined,
        },
        validate: {
            title: (value) => value.trim() === ''
                ? t`Give your event a name`
                : hasLength({max: 150}, t`Event name should be less than 150 characters`)(value),
            start_date: (value) => !value ? t`Choose when the event starts` : null,
            end_date: (value, values) => value && values.start_date && dayjs(value).isBefore(dayjs(values.start_date))
                ? t`End date must be after start date`
                : null,
            organizer_id: (value) => !value ? t`Organizer is required` : null,
        },
    });

    useEffect(() => {
        if (!organizerId && organizers.length === 1) {
            form.setFieldValue('organizer_id', String(organizers[0].id));
        }
    }, [organizersQuery.isFetched]);

    useEffect(() => {
        if (account?.event_types?.[0] && !typeChosen.current) {
            form.setFieldValue('type', account.event_types[0]);
        }
    }, [account?.id]);

    const handleCreate = (values: CreateEventFormValues) => {
        const organizer = organizers.find((item) => String(item.id) === values.organizer_id);
        const location = values.location.trim();
        const eventData: Partial<Event> = {
            title: values.title.trim(),
            category: CATEGORY_OF_TYPE[values.type],
            start_date: values.start_date ?? undefined,
            end_date: values.end_date ?? undefined,
            organizer_id: values.organizer_id,
            currency: organizer?.currency ?? account?.currency_code,
            timezone: organizer?.timezone ?? account?.timezone,
            ...(location ? {location_details: {venue_name: location}} : {}),
        };

        eventMutation.mutateAsync({eventData})
            .then((data) => navigate(`/manage/event/${data.data.id}/dashboard?new_event=true`))
            .catch((error) => errorHandler(form, error));
    };

    // Each picker in its own box: it renders a hidden input next to it.
    const dateField = (name: 'start_date' | 'end_date', label: string) => (
        <div className={classes.dateCell}>
        <DateTimePicker
            {...form.getInputProps(name)}
            label={label}
            valueFormat={dateFormat}
            dropdownType={isMobile ? 'modal' : 'popover'}
            timePickerProps={{withDropdown: true}}
            minDate={name === 'end_date' ? (form.values.start_date ?? undefined) : undefined}
            classNames={{input: classes.input, label: classes.label}}
            onChange={(value) => {
                form.setFieldValue(name, value);
                // Keeps the end after the start, three hours later by default.
                if (name === 'start_date' && value && form.values.end_date
                    && !dayjs(form.values.end_date).isAfter(dayjs(value))) {
                    form.setFieldValue('end_date', dayjs(value).add(3, 'hour').toISOString());
                }
            }}
        />
        </div>
    );

    const content = (
        <form className={classes.form} onSubmit={form.onSubmit(handleCreate)}>
            {!organizerId && organizers.length > 1 && (
                <Select
                    {...form.getInputProps('organizer_id')}
                    label={t`Organizer`}
                    placeholder={t`Select organizer`}
                    data={organizers.map((organizer) => ({value: String(organizer.id), label: organizer.name}))}
                    classNames={{input: classes.input, label: classes.label}}
                />
            )}

            <TextInput
                {...form.getInputProps('title')}
                label={t`Event name`}
                placeholder={t`E.g.: Hare Race · 10 km`}
                data-autofocus
                classNames={{input: classes.input, label: classes.label}}
            />

            <div className={classes.field} role="radiogroup" aria-labelledby="create-event-type">
                <span id="create-event-type" className={classes.label}>
                    {isMobile ? t({message: 'Type', context: 'event type'}) : t`Event type`}
                </span>
                <div className={classes.choices}>
                    {EVENT_TYPES.map((type) => (
                        <UnstyledButton
                            key={type}
                            role="radio"
                            aria-checked={form.values.type === type}
                            className={classNames(classes.choice, {[classes.choiceSelected]: form.values.type === type})}
                            onClick={() => {
                                form.setFieldValue('type', type);
                                typeChosen.current = true;
                            }}
                        >
                            {eventTypeLabel(type)}
                        </UnstyledButton>
                    ))}
                </div>
            </div>

            <div className={classes.dates}>
                {dateField('start_date', t({message: 'Start', context: 'event date'}))}
                {!isMobile && dateField('end_date', t({message: 'End', context: 'event date'}))}
            </div>

            <TextInput
                {...form.getInputProps('location')}
                label={t`Place`}
                placeholder={t`Name of the place or address`}
                maxLength={100}
                classNames={{input: classes.input, label: classes.label}}
            />

            <div className={classes.actions}>
                <Button type="submit" loading={eventMutation.isPending} className={classes.submit}>
                    {t`Create the draft`}
                </Button>
            </div>
        </form>
    );

    if (isMobile) {
        return (
            <Drawer
                opened
                onClose={onClose}
                position="bottom"
                size="auto"
                title={t`Create an event`}
                classNames={{
                    content: classes.sheet,
                    header: classes.sheetHeader,
                    title: classes.sheetTitle,
                    body: classes.sheetBody,
                    close: classes.sheetClose,
                }}
            >
                {content}
            </Drawer>
        );
    }

    return (
        <Modal
            opened
            onClose={onClose}
            centered
            size={640}
            radius={32}
            withCloseButton={false}
            classNames={{content: classes.popup, body: classes.popupBody}}
        >
            <div className={classes.popupHeader}>
                <div className={classes.popupHeading}>
                    <h2 className={classes.popupTitle}>{t`Create an event`}</h2>
                    <p className={classes.popupSubtitle}>
                        {t`The basics to get started. You can complete everything afterwards.`}
                    </p>
                </div>
                <UnstyledButton className={classes.close} onClick={onClose} aria-label={t`Close`}>
                    <img src="/interface/admin/tableau/fermer.svg" alt=""/>
                </UnstyledButton>
            </div>
            {content}
        </Modal>
    );
};
