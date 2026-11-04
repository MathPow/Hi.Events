import {useMutation, useQueryClient} from "@tanstack/react-query";
import {FinaliseOrderPayload, orderClientPublic} from "../../../../api/order.client.ts";
import {useNavigate, useParams, useSearchParams} from "react-router";
import {Button, Checkbox, NativeSelect, Skeleton, TextInput} from "@mantine/core";
import {IconCircleCheck, IconClock} from "@tabler/icons-react";
import {t, Trans} from "@lingui/macro";
import {useForm} from "@mantine/form";
import {notifications} from "@mantine/notifications";
import {GET_ORDER_PUBLIC_QUERY_KEY, useGetOrderPublic} from "../../../../queries/useGetOrderPublic.ts";
import {useGetEventPublic} from "../../../../queries/useGetEventPublic.ts";
import {useGetEventQuestionsPublic} from "../../../../queries/useGetEventQuestionsPublic.ts";
import {CheckoutOrderQuestions, CheckoutProductQuestions} from "../../../common/CheckoutQuestion";
import {Event, IdParam, Product, Question} from "../../../../types.ts";
import {useEffect, useRef, useState} from "react";
import {
    CheckoutActions,
    checkoutClasses,
    CheckoutColumns,
    CheckoutSection,
} from "../../../layouts/Checkout/CheckoutColumns";
import {CheckoutOrderPanel} from "../../../layouts/Checkout/CheckoutOrderPanel";
import {getConfig} from "../../../../utilites/config.ts";
import {HomepageInfoMessage} from "../../../common/HomepageInfoMessage";
import {ProductInfoNotice} from "../../../common/ProductInfoNotice";
import {PlatformSupportInput, platformSupportDefaultAmount, platformSupportEnabled} from "../../../common/PlatformSupportInput";
import {PublicIcon} from "../../../common/PublicIcon";
import {eventCheckoutPath, eventHomepagePath} from "../../../../utilites/urlHelper.ts";
import {showError, showInfo, showSuccess} from "../../../../utilites/notifications.tsx";
import {formatCurrency} from "../../../../utilites/currency.ts";
import countries from "../../../../../data/countries.json";
import classes from "./CollectInformation.module.scss";
import {trackEvent, AnalyticsEvents} from "../../../../utilites/analytics.ts";
import {clearWaitlistJoinedForEvent} from "../../../../hooks/useWaitlistJoined.ts";
import {useCheckoutPrefill, CheckoutPrefill} from "../../../../hooks/useCheckoutPrefill.ts";
import {useApplyPromoCodeToOrder} from "../../../../mutations/useApplyPromoCodeToOrder.ts";
import {WaiverSignature} from "../../../common/WaiverSignature";
import {DocumentSigning, emptyDocumentEntry} from "../../../common/DocumentSigning";
import {documentNeedsBirthDate} from "../../../common/OrganizerDocument/blocks.ts";
import {useGetEventDocumentsPublic} from "../../../../queries/useGetOrganizerDocuments.ts";
import {PublicOrganizerDocument} from "../../../../api/organizerDocument.client.ts";
import {isUnderAgeOnEventDay, WAIVER_ADULT_AGE} from "../../../../utilites/dates.ts";
import dayjs from "dayjs";
import {getClientLocale} from "../../../../locales.ts";
import {isEmptyHtml} from "../../../../utilites/helpers.ts";
import {OrderAddOns} from "./OrderAddOns";

const LoadingSkeleton = () =>
    (
        <CheckoutColumns panel={<Skeleton height={360} radius={32}/>}>
            <Skeleton height={180} radius={22}/>
            <Skeleton height={260} radius={22}/>
        </CheckoutColumns>
    );

// Un seul champ « Nom complet »: le prenom avant le premier espace, le nom apres (comme a l'inscription).
const splitFullName = (fullName?: string) => {
    const [firstName = '', ...lastNames] = (fullName ?? '').trim().split(/\s+/);
    return {first_name: firstName, last_name: lastNames.join(' ')};
};

// Le serveur exige un prenom et un nom: ses erreurs sur l'un ou l'autre vont au champ « Nom complet ».
const toFullNameErrors = (errors: Record<string, unknown>) => {
    const mapped: Record<string, unknown> = {};

    Object.entries(errors).forEach(([key, message]) => {
        const fullNameKey = key.replace(/\.(first_name|last_name)$/, '.full_name');
        mapped[fullNameKey] = fullNameKey === key ? message : t`Please enter your first and last name.`;
    });

    return mapped;
};

export const CollectInformation = () => {
    const {eventId, orderShortId} = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isFromWaitlist = searchParams.get('waitlist') === 'true';
    const {prefill, lock} = useCheckoutPrefill();
    const isLocked = (field: keyof CheckoutPrefill) => lock && prefill[field] !== undefined;
    const isNameLocked = isLocked('first_name') || isLocked('last_name');
    const {
        isFetched: isOrderFetched,
        data: order,
        data: {order_items: orderItems} = {},
        isError: isOrderError,
        error: orderError,
    } = useGetOrderPublic(eventId, orderShortId, ['event']);
    const {
        data: event,
        data: {product_categories: productCategories} = {},
        isFetched: isEventFetched,
        isError: isEventError,
    } = useGetEventPublic(eventId, isOrderFetched, !!order?.promo_code, order?.promo_code ?? null);
    const {
        data: questions,
        isFetched: isQuestionsFetched,
        isError: isQuestionsError
    } = useGetEventQuestionsPublic(eventId);
    // Les documents de l'organisateur lies a l'evenement (decharge, attestation...).
    const {data: eventDocuments} = useGetEventDocumentsPublic(eventId);
    const productQuestions = questions?.filter(question => question.belongs_to === "PRODUCT");
    const orderQuestions = questions?.filter(question => question.belongs_to === "ORDER");
    const products = productCategories?.flatMap(category => category.products);
    const queryClient = useQueryClient();

    // L'acheteur revient de l'etape du paiement (« Modifier »): ses coordonnees et ses participants
    // sont deja enregistres, rien n'est paye. Le total ne doit plus bouger (le paiement Stripe deja
    // prepare garde son montant): ni contribution, ni code promo.
    const isEditing = order?.status === 'RESERVED' && !!order?.email
        && (order.payment_status === 'AWAITING_PAYMENT' || order.payment_status === 'PAYMENT_FAILED');
    const requireBillingAddress = event?.settings?.require_billing_address;
    const isPerOrderCollection = event?.settings?.attendee_details_collection_method === 'PER_ORDER';
    const allowCopyToAllAttendees = event?.settings?.allow_copy_details_to_all_attendees ?? true;

    const isEmailValid = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const EmailCheckIcon = () => (
        <IconCircleCheck size={18} style={{color: 'var(--public-accent)'}}/>
    );

    let productIndex = 0;

    const form = useForm({
        initialValues: {
            order: {
                full_name: "",
                email: "",
                email_confirmation: "",
                address: {},
                questions: {},
                opted_into_marketing: false,
            },
            products: [{
                full_name: "",
                email: "",
                email_confirmation: "",
                product_price_id: "",
                product_id: "",
                questions: {},
            }],
        },
        validate: {
            order: {
                email_confirmation: (value, values) =>
                    value !== values.order.email ? t`Email addresses do not match` : null,
            },
            products: {
                email_confirmation: (value, values, path) => {
                    const index = parseInt(path.split('.')[1]);
                    const product = values.products[index];
                    if (product && product.email !== value) {
                        return t`Email addresses do not match`;
                    }
                    return null;
                },
            },
        },
        validateInputOnBlur: true,
    });

    const getTicketAttendeeIndices = (): number[] => {
        if (!products || !form.values.products) return [];

        const attendeeProductIds = new Set<IdParam>(
            products
                .filter(product => product && product.product_type === 'TICKET')
                .map(product => product!.id)
        );

        return form.values.products
            .map((product, index) => attendeeProductIds.has(product.product_id) ? index : -1)
            .filter(index => index !== -1);
    };

    const getFirstTicketAttendeeIndex = (): number => {
        const indices = getTicketAttendeeIndices();
        return indices.length > 0 ? indices[0] : -1;
    };

    const totalTicketAttendees = getTicketAttendeeIndices().length;

    // The event's waiver: each ticket's attendee signs it (once for the order when details are per order).
    const waiverText = event?.settings?.waiver_text && !isEmptyHtml(event.settings.waiver_text)
        ? event.settings.waiver_text
        : null;
    const dateOfBirthQuestion = productQuestions?.find(question => question.preset_key === 'date_of_birth');

    // Les documents signes en ligne: chaque fiche en garde une entree par document, dans cet ordre.
    const linkedDocuments: PublicOrganizerDocument[] = eventDocuments ?? [];
    const onlineDocuments = linkedDocuments.filter(document => document.signing_mode === 'ONLINE');
    const onlineDocumentsKey = onlineDocuments.map(document => document.id).join(',');
    // Sans question « date de naissance », les documents qui en ont besoin la demandent.
    const askDocumentBirthDate = !dateOfBirthQuestion
        && linkedDocuments.some(document => documentNeedsBirthDate(document.blocks, document.audience));

    /** The participant form's date of birth, when the attendee answered it (or the one asked with the documents). */
    const attendeeBirthDate = (productIndex: number): string | undefined => {
        if (!dateOfBirthQuestion) {
            return (form.values.products[productIndex] as { document_birth_date?: string } | undefined)?.document_birth_date;
        }
        // An empty object until the form is filled from the order (createProductsAndQuestions).
        const questions = form.values.products[productIndex]?.questions;

        return (Array.isArray(questions) ? questions as { question_id: IdParam, response?: { answer?: string } }[] : [])
            .find(question => question.question_id === dateOfBirthQuestion.id)
            ?.response?.answer;
    };

    const isAttendeeUnder = (productIndex: number) => (age: number): boolean =>
        !!event && isUnderAgeOnEventDay(attendeeBirthDate(productIndex), event.start_date, event.timezone, age);

    const isAttendeeMinor = (productIndex: number): boolean => isAttendeeUnder(productIndex)(WAIVER_ADULT_AGE);

    // « Meme personne que l'acheteur », coche par participant. Au depart, le premier billet;
    // les suivants seulement si l'evenement permet de copier vers tous les participants.
    const [copiedIndices, setCopiedIndices] = useState<number[] | null>(null);
    const firstTicketIndex = getFirstTicketAttendeeIndex();
    const copiedTargets = copiedIndices ?? (firstTicketIndex === -1 ? [] : [firstTicketIndex]);
    const canCopyToAttendee = (index: number) =>
        !lock && !isPerOrderCollection && (index === firstTicketIndex || allowCopyToAllAttendees);

    const handleSameAsBuyerChange = (index: number, checked: boolean) => {
        const others = copiedTargets.filter(target => target !== index);
        setCopiedIndices(checked ? [...others, index] : others);

        const {full_name, email} = form.values.order;
        const product = form.values.products[index];

        ['full_name', 'email', 'email_confirmation'].forEach(field => form.clearFieldError(`products.${index}.${field}`));
        form.setFieldValue(`products.${index}`, checked
            ? {...product, full_name, email, email_confirmation: email}
            : {
                ...product,
                full_name: product.full_name === full_name ? "" : product.full_name,
                email: product.email === email ? "" : product.email,
                email_confirmation: product.email_confirmation === email ? "" : product.email_confirmation,
            });
    };

    // Les participants copies suivent l'acheteur pendant qu'il tape. Un champ du
    // participant modifie a la main ne vaut plus l'ancienne valeur copiee: on n'y
    // touche plus, pour qu'on puisse y mettre le nom ou le courriel de quelqu'un d'autre.
    const previousOrderDetails = useRef({full_name: "", email: ""});

    // Le bouton est au bas d'un long formulaire: sans ca, une question obligatoire
    // laissee vide plus haut donne l'impression que le bouton ne fait rien.
    const shouldScrollToError = useRef(false);

    useEffect(() => {
        if (!shouldScrollToError.current || Object.keys(form.errors).length === 0) {
            return;
        }

        shouldScrollToError.current = false;

        const field = document.querySelector<HTMLElement>('[aria-invalid="true"]');
        field?.scrollIntoView({behavior: 'smooth', block: 'center'});
        field?.focus({preventScroll: true});
    }, [form.errors]);

    useEffect(() => {
        const previous = previousOrderDetails.current;
        const {full_name, email} = form.values.order;
        previousOrderDetails.current = {full_name, email};

        if (isPerOrderCollection) {
            return;
        }

        const ticketIndices = getTicketAttendeeIndices();
        const targets = copiedTargets.filter(index => ticketIndices.includes(index));

        if (targets.length === 0) {
            return;
        }

        const follow = (current: string, before: string, next: string) => current === before ? next : current;

        form.setFieldValue('products', form.values.products.map((product, index) => targets.includes(index)
            ? {
                ...product,
                full_name: follow(product.full_name, previous.full_name, full_name),
                email: follow(product.email, previous.email, email),
                email_confirmation: follow(product.email_confirmation, previous.email, email),
            }
            : product));
    }, [form.values.order.full_name, form.values.order.email]);

    // Doit etre applique AVANT finaliseOrder: le PaymentIntent est cree a l'etape
    // suivante et n'est jamais recree ensuite, donc une contribution ajoutee plus
    // tard ne serait pas debitee.
    const [platformContribution, setPlatformContribution] = useState<number>(platformSupportDefaultAmount);

    // Une commande gratuite ne cree pas de PaymentIntent: il n'y a rien a quoi
    // rattacher la contribution, donc on ne la demande pas.
    const canContribute = order?.is_payment_required === true
        && event?.organizer?.settings?.platform_support_enabled !== false;

    const mutation = useMutation({
        mutationFn: (orderData: FinaliseOrderPayload) => orderClientPublic.finaliseOrder(Number(eventId), String(orderShortId), orderData),

        onSuccess: (data) => {
            const nextPage = order?.is_payment_required ? 'payment' : 'summary';
            if (nextPage === 'summary') {
                trackEvent(AnalyticsEvents.PURCHASE_COMPLETED_FREE);
            }
            // Les participants modifies, pas ceux du premier envoi encore en cache.
            queryClient.invalidateQueries({queryKey: [GET_ORDER_PUBLIC_QUERY_KEY]});
            navigate(eventCheckoutPath(eventId, data.data.short_id, nextPage));
        },

        onError: (error: any) => {
            if (error?.response?.data?.errors && Object.keys(error?.response?.data?.errors).length > 0) {
                shouldScrollToError.current = true;
                form.setErrors(toFullNameErrors(error.response.data.errors) as any);
            } else if (error?.response?.data?.message) {
                notifications.show({
                    message: error?.response?.data?.message,
                });

                // if it's a 409, we need to redirect to the event page as the order is no longer valid
                if (error.response.status === 409) {
                    navigate(eventHomepagePath(event as Event));
                }
            }
        }
    });

    const promoCodeMutation = useApplyPromoCodeToOrder();

    const handlePromoCodeChange = (promoCode: string | null) => {
        promoCodeMutation.mutate({eventId, orderShortId, promoCode}, {
            onSuccess: () => {
                if (promoCode) {
                    showSuccess(t`Promo code applied`);
                } else {
                    showInfo(t`Promo code removed`);
                }
            },
            onError: (error: any) => {
                const promoCodeError = error?.response?.data?.errors?.promo_code;

                showError(
                    (Array.isArray(promoCodeError) ? promoCodeError[0] : promoCodeError)
                    ?? error?.response?.data?.message
                    ?? t`That promo code is invalid`
                );
            },
        });
    };

    const createProductIdToQuestionMap = () => {
        const productIdToQuestionMap = new Map();

        productQuestions?.forEach(question => {
            question.product_ids?.forEach(id => {
                const existingQuestions = productIdToQuestionMap.get(id);
                productIdToQuestionMap.set(
                    id,
                    existingQuestions ? [...existingQuestions, question] : [question]
                );
            });
        });

        return productIdToQuestionMap;
    }

    const createProductsAndQuestions = (productIdToQuestionMap: Map<number, Question[]>) => {
        const products: any = [];

        orderItems?.forEach(orderItem => {
            Array.from(Array(orderItem?.quantity)).map(() => {
                products.push({
                    product_price_id: orderItem?.product_price_id,
                    product_id: orderItem?.product_id,
                    full_name: "",
                    email: "",
                    email_confirmation: "",
                    waiver: {accepted: false, signed_name: "", guardian_name: ""},
                    documents: onlineDocuments.map(emptyDocumentEntry),
                    document_birth_date: "",
                    questions: productIdToQuestionMap.get(orderItem?.product_id)?.map((question: Question) => {
                        return {
                            question_id: question.id,
                            response: {},
                        }
                    })
                });
            });
        });

        return products;
    }

    const createFormOrderQuestions = () => {
        const formOrderQuestions: any = [];

        orderQuestions?.forEach(orderQuestion => {
            formOrderQuestions.push({
                question_id: orderQuestion.id,
                response: {},
            });
        });

        return formOrderQuestions;
    }

    const handleSubmit = async (values: any) => {
        if (canContribute && !isEditing && platformSupportEnabled() && platformContribution > 0) {
            try {
                await orderClientPublic.setPlatformContribution(Number(eventId), String(orderShortId), platformContribution);
            } catch {
                // Une contribution facultative ne doit pas bloquer un achat: on
                // poursuit sans elle plutot que de renvoyer l'acheteur a un echec.
                showError(t`Your contribution could not be applied, continuing without it.`);
            }
        }

        // Per order, the buyer's one signature stands for every ticket's attendee.
        const firstTicketIndex = getFirstTicketAttendeeIndex();
        if (waiverText && isPerOrderCollection && firstTicketIndex !== -1) {
            const signature = values.products[firstTicketIndex].waiver;
            const ticketIndices = getTicketAttendeeIndices();
            values = {
                ...values,
                products: values.products.map((product: any, index: number) =>
                    ticketIndices.includes(index) ? {...product, waiver: signature} : product
                ),
            };
        }
        // Les documents aussi: signes une fois pour la commande, valables pour chaque billet.
        if (linkedDocuments.length && isPerOrderCollection && firstTicketIndex !== -1) {
            const {documents, document_birth_date} = values.products[firstTicketIndex];
            const ticketIndices = getTicketAttendeeIndices();
            values = {
                ...values,
                products: values.products.map((product: any, index: number) =>
                    ticketIndices.includes(index) ? {...product, documents, document_birth_date} : product
                ),
            };
        }

        const {full_name: orderFullName, ...orderValues} = values.order;

        mutation.mutate({
            ...values,
            order: {...orderValues, ...splitFullName(orderFullName)},
            products: values.products.map(({full_name, ...product}: any) => ({...product, ...splitFullName(full_name)})),
        });
    };

    useEffect(() => {
        if (isEventFetched && isOrderFetched && isQuestionsFetched && productQuestions && orderQuestions) {
            const builtProducts = createProductsAndQuestions(createProductIdToQuestionMap());
            const formOrderQuestions = createFormOrderQuestions();

            const prefillFullName = [prefill.first_name, prefill.last_name].filter(Boolean).join(' ');
            const savedFullName = isEditing ? [order?.first_name, order?.last_name].filter(Boolean).join(' ') : '';
            const orderPrefill = {
                ...(prefillFullName ? {full_name: prefillFullName} : {}),
                ...(prefill.email !== undefined ? {email: prefill.email, email_confirmation: prefill.email} : {}),
                // De retour du paiement: ce que l'acheteur avait envoye.
                ...(savedFullName ? {full_name: savedFullName} : {}),
                ...(isEditing && order?.email ? {email: order.email, email_confirmation: order.email} : {}),
            };

            const ticketProductIds = new Set(
                (products ?? [])
                    .filter(product => product && product.product_type === 'TICKET')
                    .map(product => product!.id)
            );

            // Chaque participant deja enregistre retrouve sa place, billet par billet (meme prix).
            const savedAttendees = isEditing ? [...(order?.attendees ?? [])] : [];
            const takeSavedAttendee = (productPriceId: unknown) => {
                const index = savedAttendees.findIndex(attendee => String(attendee.product_price_id) === String(productPriceId));
                return index === -1 ? undefined : savedAttendees.splice(index, 1)[0];
            };

            const prefilledProducts = builtProducts.map((product: any) => {
                if (isPerOrderCollection || !ticketProductIds.has(product.product_id)) {
                    return product;
                }
                const saved = takeSavedAttendee(product.product_price_id);

                return saved
                    ? {
                        ...product,
                        full_name: [saved.first_name, saved.last_name].filter(Boolean).join(' '),
                        email: saved.email,
                        email_confirmation: saved.email,
                    }
                    : {...product, ...orderPrefill};
            });

            form.setValues({
                ...form.values,
                products: prefilledProducts,
                order: {
                    ...form.values.order,
                    ...orderPrefill,
                    ...(isEditing && order?.address ? {address: order.address} : {}),
                    questions: formOrderQuestions,
                },
            });
        }
        // prefill/lock intentionally omitted: they're memoized off query params that don't change during the page's lifetime
    }, [isEventFetched, isOrderFetched, isQuestionsFetched]);

    // De la merch ajoutee ou retiree (« Ajouter a votre commande ») change les lignes de la
    // commande: les fiches du formulaire (une par article, dans l'ordre des lignes) suivent.
    // Chaque fiche gardee reprend ce qu'on y avait ecrit (meme prix, meme rang); une nouvelle
    // part vide. Sans ca, la fin de commande recevrait un prix retire de la commande, ou des
    // fiches decalees par rapport aux billets.
    const formEntries: { product_price_id?: IdParam }[] = Array.isArray(form.values.products) ? form.values.products : [];
    const formEntriesKey = formEntries.map(entry => entry.product_price_id).join(',');
    const orderEntriesKey = (orderItems ?? [])
        .flatMap(item => Array.from({length: item.quantity ?? 0}, () => item.product_price_id))
        .join(',');
    const isFormBuilt = formEntries.some(entry => !!entry.product_price_id);
    // Les documents arrivent parfois apres le formulaire: chaque fiche recoit ses entrees.
    useEffect(() => {
        if (!isFormBuilt || !onlineDocumentsKey) {
            return;
        }
        const entries = form.values.products as { documents?: { document_id: number }[] }[];
        const upToDate = entries.every(entry =>
            (entry.documents ?? []).map(document => document.document_id).join(',') === onlineDocumentsKey);
        if (upToDate) {
            return;
        }
        form.setFieldValue('products', entries.map((entry: any) => ({
            ...entry,
            document_birth_date: entry.document_birth_date ?? '',
            documents: onlineDocuments.map(document =>
                entry.documents?.find((existing: { document_id: number }) => existing.document_id === document.id)
                ?? emptyDocumentEntry(document)),
        })));
        // Seulement quand les documents ou les fiches changent.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFormBuilt, onlineDocumentsKey, formEntriesKey]);

    // Les coordonnees deja envoyees (on revient du paiement): plus de merch a ajouter.
    const detailsAlreadySent = !!order?.email || order?.payment_status === 'AWAITING_PAYMENT';

    useEffect(() => {
        if (!isFormBuilt || !orderItems || !productQuestions || formEntriesKey === orderEntriesKey) {
            return;
        }

        const fresh = createProductsAndQuestions(createProductIdToQuestionMap());
        const seen = new Map<IdParam | undefined, number>();
        const movedTo = new Map<number, number>();

        const rebuilt = fresh.map((entry: { product_price_id?: IdParam }, newIndex: number) => {
            const rank = seen.get(entry.product_price_id) ?? 0;
            seen.set(entry.product_price_id, rank + 1);

            const oldIndex = formEntries
                .map((old, index) => old.product_price_id === entry.product_price_id ? index : -1)
                .filter(index => index !== -1)[rank];

            if (oldIndex === undefined) {
                return entry;
            }

            movedTo.set(oldIndex, newIndex);
            return form.values.products[oldIndex];
        });

        form.setFieldValue('products', rebuilt);
        setCopiedIndices(current => current === null
            ? null
            : current.flatMap(index => movedTo.has(index) ? [movedTo.get(index)!] : []));
        // Les cles resument les lignes de la commande et les fiches: elles suffisent.
    }, [isFormBuilt, formEntriesKey, orderEntriesKey]);

    useEffect(() => {
        if ((order && event) && order?.is_expired) {
            showInfo(t`This order has expired. Please start again.`);
            navigate(`/event/${eventId}/${event.slug}`);
        }
    }, [order, event]);

    if (!isEventFetched || !isOrderFetched) {
        return <LoadingSkeleton/>
    }

    if (order?.status === 'ABANDONED') {
        return <HomepageInfoMessage
            status="cancelled"
            message={t`Order was cancelled`}
            subtitle={t`This order was abandoned. You can start a new order anytime.`}
            link={eventHomepagePath(event as Event)}
            linkText={t`Back to Event`}
        />;
    }

    if (order?.payment_status === 'AWAITING_PAYMENT' && !isEditing) {
        return <HomepageInfoMessage
            status="awaiting_payment"
            message={t`Waiting for payment`}
            subtitle={t`Complete your payment to secure your tickets.`}
            link={eventCheckoutPath(eventId, orderShortId, 'payment')}
            linkText={t`Complete Payment`}
        />;
    }

    if (order?.status === 'COMPLETED') {
        return <HomepageInfoMessage
            status="success"
            message={t`Order complete`}
            subtitle={t`Your tickets have been confirmed.`}
            link={eventCheckoutPath(eventId, orderShortId, 'summary')}
            linkText={t`View Order Details`}
        />;
    }

    if (order?.status === 'CANCELLED') {
        return <HomepageInfoMessage
            status="cancelled"
            message={t`Order cancelled`}
            subtitle={t`This order was cancelled. You can start a new order anytime.`}
            link={eventHomepagePath(event as Event)}
            linkText={t`Back to Event`}
        />;
    }

    if (isOrderError && (orderError as any)?.response?.status === 404) {
        if (isFromWaitlist && eventId) {
            clearWaitlistJoinedForEvent(eventId);
        }

        return (
            <HomepageInfoMessage
                status="not_found"
                message={isFromWaitlist ? t`Waitlist offer expired` : t`Order not found`}
                subtitle={isFromWaitlist
                    ? t`Your waitlist offer has expired and we were unable to complete your order. Please rejoin the waitlist to be notified when more spots become available.`
                    : t`We couldn't find this order. It may have been removed.`}
                link={eventHomepagePath(event as Event)}
                linkText={t`Go to Event Page`}
            />
        );
    }

    if (isOrderError || isEventError || isQuestionsError) {
        return (
            <HomepageInfoMessage
                status="error"
                message={t`Something went wrong`}
                subtitle={t`We hit a snag loading this page. Please try again.`}
                link={eventHomepagePath(event as Event)}
                linkText={t`Back to Event`}
            />
        );
    }

    // Ce que la caisse sait deja des champs automatiques des documents.
    const documentAutoValues = (participantName?: string, birthDate?: string): Partial<Record<string, string>> => ({
        participant_name: participantName?.trim() || undefined,
        date_of_birth: birthDate ? dayjs(birthDate).locale(getClientLocale()).format('D MMMM YYYY') : undefined,
        event_name: event?.title,
        event_date: event ? dayjs.utc(event.start_date).tz(event.timezone || 'UTC').locale(getClientLocale()).format('D MMMM YYYY') : undefined,
        organizer_name: event?.organizer?.name,
    });

    const orderRequiresAttendeeDetails = orderItems?.some(orderItem => {
        const product = products?.find(product => product!.id === orderItem.product_id);
        return product?.product_type === 'TICKET';
    });

    // Une fiche par billet (ou par article qui a des questions), dans l'ordre des produits du formulaire.
    const ticketIndices = getTicketAttendeeIndices();
    const attendeeCards = orderItems?.flatMap(orderItem => {
        const product = products?.find(product => product!.id === orderItem.product_id);
        const productRequiresDetails = product?.product_type === 'TICKET' && !isPerOrderCollection;
        const productHasQuestions = !!productQuestions?.some(question => question.product_ids?.includes(orderItem.product_id));

        if (!product) {
            return [];
        }

        if (!productRequiresDetails && !productHasQuestions) {
            // Still increment productIndex for each item in the quantity
            // to maintain correct form field indices
            productIndex += orderItem.quantity ?? 0;
            return [];
        }

        return Array.from(Array(orderItem?.quantity)).map((_, index) => {
            const currentProductIndex = productIndex;
            const isTicketAttendee = ticketIndices.includes(currentProductIndex);
            const canCopy = productRequiresDetails && isTicketAttendee && canCopyToAttendee(currentProductIndex);
            const isCopied = canCopy && copiedTargets.includes(currentProductIndex);
            const cardLabel = product.product_type === 'TICKET' ? t`Attendee` : t`Item`;

            const card = (
                <div key={`${orderItem.id} ${index}`} className={checkoutClasses.subCard} data-rough>
                    <div className={classes.attendeeHeader}>
                        <h3 className={checkoutClasses.subCardTitle}>
                            {`${orderItem.item_name} · ${cardLabel} ${index + 1}`}
                        </h3>
                        <span className={classes.pricePill} data-rough>
                            {formatCurrency(orderItem.price, order?.currency)}
                        </span>
                    </div>

                    {canCopy && (
                        <Checkbox
                            label={t`Same person as the buyer`}
                            checked={isCopied}
                            onChange={(event) => handleSameAsBuyerChange(currentProductIndex, event.currentTarget.checked)}
                        />
                    )}

                    {/* Copie de l'acheteur: ses champs suivent ceux du haut, inutile de les montrer. */}
                    {productRequiresDetails && !isCopied && (
                        <div className={checkoutClasses.fieldGrid}>
                            <TextInput
                                className={checkoutClasses.fieldFull}
                                withAsterisk
                                label={t`Full name`}
                                placeholder={t`First and last name`}
                                autoComplete="off"
                                disabled={isNameLocked}
                                {...form.getInputProps(`products.${currentProductIndex}.full_name`)}
                            />
                            <TextInput
                                withAsterisk
                                type={"email"}
                                label={t`Email`}
                                placeholder={t`name@example.com`}
                                autoComplete="off"
                                disabled={isLocked('email')}
                                rightSection={isEmailValid(form.values.products[currentProductIndex]?.email || '') ?
                                    <EmailCheckIcon/> : null}
                                {...form.getInputProps(`products.${currentProductIndex}.email`)}
                            />
                            <TextInput
                                withAsterisk
                                type={"email"}
                                label={t`Confirm email`}
                                placeholder={t`name@example.com`}
                                autoComplete="off"
                                disabled={isLocked('email')}
                                rightSection={isEmailValid(form.values.products[currentProductIndex]?.email_confirmation || '') ?
                                    <EmailCheckIcon/> : null}
                                {...form.getInputProps(`products.${currentProductIndex}.email_confirmation`)}
                            />
                        </div>
                    )}

                    {productHasQuestions && productQuestions && (
                        <>
                            <div className={checkoutClasses.questions}>
                                <CheckoutProductQuestions
                                    index={currentProductIndex}
                                    product={product}
                                    form={form}
                                    questions={productQuestions}/>
                            </div>
                            <p className={classes.questionsNote}>
                                <PublicIcon name={'info'} size={16} className={classes.questionsNoteIcon}/>
                                {t`Questions added by the organizer.`}
                            </p>
                        </>
                    )}

                    {waiverText && productRequiresDetails && (
                        <WaiverSignature
                            waiverText={waiverText}
                            form={form}
                            path={`products.${currentProductIndex}.waiver`}
                            isMinor={isAttendeeMinor(currentProductIndex)}
                        />
                    )}

                    {linkedDocuments.length > 0 && productRequiresDetails && (
                        <DocumentSigning
                            documents={linkedDocuments}
                            form={form}
                            path={`products.${currentProductIndex}`}
                            isMinor={isAttendeeMinor(currentProductIndex)}
                            isUnder={isAttendeeUnder(currentProductIndex)}
                            askBirthDate={askDocumentBirthDate}
                            autoValues={documentAutoValues(form.values.products[currentProductIndex]?.full_name, (form.values.products[currentProductIndex] as { document_birth_date?: string } | undefined)?.document_birth_date)}
                        />
                    )}
                </div>
            );

            productIndex++;

            return card;
        });
    }) ?? [];

    const totalAmount = order?.total_refunded
        ? order.total_gross - order.total_refunded
        : order?.total_gross ?? 0;

    return (
        <form onSubmit={form.onSubmit(handleSubmit, () => {
            shouldScrollToError.current = true;
        })}>
            <CheckoutColumns
                panel={(event && order) && (
                    <CheckoutOrderPanel
                        event={event}
                        order={order}
                        notice={<ProductInfoNotice settings={event.settings}/>}
                        onPromoCodeChange={isEditing ? undefined : handlePromoCodeChange}
                        isPromoCodePending={promoCodeMutation.isPending}
                    />
                )}
            >
                {isFromWaitlist && (
                    <div className={classes.waitlistBanner} data-rough>
                        <div className={classes.waitlistBannerIcon}>
                            <IconClock size={22}/>
                        </div>
                        <div>
                            <p className={classes.waitlistBannerTitle}>
                                {t`You've been offered a spot!`}
                            </p>
                            <p className={classes.waitlistBannerText}>
                                {t`Complete your order to secure your tickets. This offer is time-limited, so don't wait too long.`}
                            </p>
                        </div>
                    </div>
                )}

                <CheckoutSection
                    number={1}
                    title={t`Your contact details`}
                    subtitle={t`We'll send your tickets to this email`}
                >
                    <div className={checkoutClasses.fieldGrid}>
                        <TextInput
                            className={checkoutClasses.fieldFull}
                            withAsterisk
                            label={t`Full name`}
                            placeholder={t`First and last name`}
                            autoComplete="name"
                            disabled={isNameLocked}
                            {...form.getInputProps("order.full_name")}
                        />
                        <TextInput
                            withAsterisk
                            type={"email"}
                            label={t`Email`}
                            placeholder={t`name@example.com`}
                            autoComplete="email"
                            disabled={isLocked('email')}
                            rightSection={isEmailValid(form.values.order.email) ? <EmailCheckIcon/> : null}
                            {...form.getInputProps("order.email")}
                        />
                        <TextInput
                            withAsterisk
                            type={"email"}
                            label={t`Confirm email`}
                            placeholder={t`name@example.com`}
                            autoComplete="email"
                            disabled={isLocked('email')}
                            rightSection={isEmailValid(form.values.order.email_confirmation) ? <EmailCheckIcon/> : null}
                            {...form.getInputProps("order.email_confirmation")}
                        />
                    </div>

                    {requireBillingAddress && (
                        <div className={checkoutClasses.subCard} data-rough>
                            <h3 className={checkoutClasses.subCardTitle}>
                                {t`Billing Address`}
                            </h3>

                            <div className={checkoutClasses.fieldGrid}>
                                <TextInput
                                    withAsterisk
                                    label={t`Address Line 1`}
                                    placeholder={t`Address Line 1`}
                                    {...form.getInputProps("order.address.address_line_1")}
                                />
                                <TextInput
                                    label={t`Address Line 2`}
                                    placeholder={t`Address Line 2`}
                                    {...form.getInputProps("order.address.address_line_2")}
                                />
                                <TextInput
                                    withAsterisk
                                    label={t`City`}
                                    placeholder={t`City`}
                                    {...form.getInputProps("order.address.city")}
                                />
                                <TextInput
                                    withAsterisk
                                    label={t`State or Region`}
                                    placeholder={t`State or Region`}
                                    {...form.getInputProps("order.address.state_or_region")}
                                />
                                <TextInput
                                    label={t`ZIP / Postal Code`}
                                    placeholder={t`ZIP or Postal Code`}
                                    {...form.getInputProps("order.address.zip_or_postal_code")}
                                />
                                <NativeSelect
                                    withAsterisk
                                    label={t`Country`}
                                    data={countries}
                                    {...form.getInputProps("order.address.country")}
                                />
                            </div>
                        </div>
                    )}

                    {orderQuestions && orderQuestions.length > 0 && (
                        <div className={checkoutClasses.questions}>
                            <CheckoutOrderQuestions form={form} questions={orderQuestions}/>
                        </div>
                    )}

                    {waiverText && isPerOrderCollection && totalTicketAttendees > 0 && (
                        <div className={`${checkoutClasses.subCard} ${classes.orderWaiver}`} data-rough>
                            <WaiverSignature
                                waiverText={waiverText}
                                form={form}
                                path={`products.${getFirstTicketAttendeeIndex()}.waiver`}
                                isMinor={false}
                            />
                        </div>
                    )}

                    {linkedDocuments.length > 0 && isPerOrderCollection && totalTicketAttendees > 0 && (
                        <DocumentSigning
                            documents={linkedDocuments}
                            form={form}
                            path={`products.${getFirstTicketAttendeeIndex()}`}
                            isMinor={isAttendeeMinor(getFirstTicketAttendeeIndex())}
                            isUnder={isAttendeeUnder(getFirstTicketAttendeeIndex())}
                            askBirthDate={askDocumentBirthDate}
                            autoValues={documentAutoValues(form.values.order?.full_name, (form.values.products[getFirstTicketAttendeeIndex()] as { document_birth_date?: string } | undefined)?.document_birth_date)}
                        />
                    )}

                    {event?.settings?.show_marketing_opt_in && (
                        <Checkbox
                            label={t`Keep me updated on news and events from ${event?.organizer?.name || t`this organizer`}`}
                            {...form.getInputProps('order.opted_into_marketing', {type: 'checkbox'})}
                        />
                    )}
                </CheckoutSection>

                {attendeeCards.length > 0 && (
                    <CheckoutSection
                        number={2}
                        title={t`Attendees`}
                        subtitle={orderRequiresAttendeeDetails ? t`One form per ticket.` : undefined}
                    >
                        {attendeeCards}
                    </CheckoutSection>
                )}

                {/* La merch de l'evenement, avant le paiement seulement: une fois les coordonnees
                    envoyees, le montant du paiement est fixe. */}
                {!!order && !!event && !detailsAlreadySent && (
                    <OrderAddOns
                        number={attendeeCards.length > 0 ? 3 : 2}
                        event={event as Event}
                        order={order}
                        products={(products ?? []).filter((product): product is Product => !!product)}
                    />
                )}

                {!!event?.settings?.pre_checkout_message && (
                    <div className={checkoutClasses.subCard} data-rough>
                        <div dangerouslySetInnerHTML={{__html: event?.settings?.pre_checkout_message}}/>
                    </div>
                )}

                {canContribute && !isEditing && platformSupportEnabled() && (
                    <PlatformSupportInput
                        value={platformContribution}
                        onChange={setPlatformContribution}
                        currency={event?.currency}
                        disabled={mutation.isPending}
                    />
                )}

                <CheckoutActions>
                    <div className={checkoutClasses.stickyTotal}>
                        <span>{t`Total`}</span>
                        <span>{formatCurrency(totalAmount, order?.currency)}</span>
                    </div>
                    <Button
                        className={checkoutClasses.primaryButton}
                        loading={mutation.isPending}
                        type="submit"
                        rightSection={order?.is_payment_required ? <PublicIcon name={'fleche'} size={20}/> : undefined}
                        leftSection={!order?.is_payment_required ? <PublicIcon name={'coche'} size={20}/> : undefined}
                    >
                        {order?.is_payment_required ? t`Continue to Payment` : t`Complete Order`}
                    </Button>
                    {!!getConfig('VITE_TOS_URL') && (
                        <p className={checkoutClasses.actionsNote}>
                            <Trans>
                                By continuing, you agree to the{' '}
                                <a
                                    href={getConfig('VITE_TOS_URL', 'https://hi.events/terms-of-service') as string}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {getConfig('VITE_APP_NAME', 'Hi.Events')} Terms of Service
                                </a>
                            </Trans>
                        </p>
                    )}
                </CheckoutActions>
            </CheckoutColumns>
        </form>
    );
}

export default CollectInformation;
