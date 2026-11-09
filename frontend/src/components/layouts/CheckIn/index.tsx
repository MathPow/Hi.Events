import {useParams} from "react-router";
import {useGetCheckInListPublic} from "../../../queries/useGetCheckInListPublic.ts";
import React, {useCallback, useEffect, useRef, useState} from "react";
import {useDebouncedValue, useDisclosure, useMediaQuery, useNetwork} from "@mantine/hooks";
import {Attendee, QueryFilters, QueryFilterOperator} from "../../../types.ts";
import {showError, showSuccess} from "../../../utilites/notifications.tsx";
import {t, Trans} from "@lingui/macro";
import {AxiosError} from "axios";
import classes from "./CheckIn.module.scss";
import {Button, Modal, UnstyledButton} from "@mantine/core";
import {SearchBar} from "../../common/SearchBar";
import {IconQrcode, IconShoppingCart, IconVolume, IconVolumeOff, IconWifiOff} from "@tabler/icons-react";
import {QRScannerComponent} from "../../common/AttendeeCheckInTable/QrScanner.tsx";
import {useGetCheckInListAttendees} from "../../../queries/useGetCheckInListAttendeesPublic.ts";
import {useCreateCheckInPublic} from "../../../mutations/useCreateCheckInPublic.ts";
import {useDeleteCheckInPublic} from "../../../mutations/useDeleteCheckInPublic.ts";
import {NoResultsSplash} from "../../common/NoResultsSplash";
import {Countdown} from "../../common/Countdown";
import {publicCheckInClient} from "../../../api/check-in.client.ts";
import {isSsr} from "../../../utilites/helpers.ts";
import {AttendeeList} from "../../common/CheckIn/AttendeeList";
import {CheckInOptionsModal} from "../../common/CheckIn/CheckInOptionsModal";
import {ScannerSelectionModal} from "../../common/CheckIn/ScannerSelectionModal";
import {HidScannerStatus} from "../../common/CheckIn/HidScannerStatus";
import {ListIntro, PinScreen} from "../../common/CheckIn/PinScreen";
import {PhoneScanner, ScanOutcome, ScanResult} from "../../common/CheckIn/PhoneScanner";
import scannerClasses from "../../common/CheckIn/Scanner.module.scss";
import {DoorSaleModal} from "../../common/CheckIn/DoorSaleModal";
import {clearCheckInPin, getCheckInPin, setCheckInPin} from "../../../utilites/checkInPin.ts";
import {useDehorsAppTheme} from "../../../hooks/useDehorsAppTheme.ts";
import {intlLocale} from "../../../utilites/intlLocale.ts";

// Un billet traite (entre ou refuse) il y a moins que ca et relu par la camera: on se tait.
const RECENT_SCAN_MS = 6000;

const CheckIn = () => {
    useDehorsAppTheme();
    const networkStatus = useNetwork();
    const {checkInListShortId} = useParams();
    const CheckInListQuery = useGetCheckInListPublic(checkInListShortId);
    const checkInList = CheckInListQuery?.data?.data;
    const event = checkInList?.event;
    const eventSettings = event?.settings;
    const [searchQuery, setSearchQuery] = useState('');
    const [searchQueryDebounced] = useDebouncedValue(searchQuery, 200);
    const [qrScannerOpen, setQrScannerOpen] = useState(false);
    const [scannerSelectionOpen, setScannerSelectionOpen] = useState(false);
    const [hidScannerMode, setHidScannerMode] = useState(false);
    const [currentBarcode, setCurrentBarcode] = useState('');
    const [pageHasFocus, setPageHasFocus] = useState(true);
    const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isProcessingRef = useRef(false);
    const processedBarcodesRef = useRef<Set<string>>(new Set());
    const recentScansRef = useRef(new Map<string, number>());
    const lastScanTimeRef = useRef<number>(0);
    const scanSuccessAudioRef = useRef<HTMLAudioElement | null>(null);
    const scanErrorAudioRef = useRef<HTMLAudioElement | null>(null);
    const [isSoundOn, setIsSoundOn] = useState(() => {
        if (isSsr()) return true;
        // Use a unified sound setting for all scanners
        const storedIsSoundOn = localStorage.getItem("scannerSoundOn");
        return storedIsSoundOn === null ? true : JSON.parse(storedIsSoundOn);
    });
    const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
    const [pinFailed, setPinFailed] = useState(false);
    const [hasPin, setHasPin] = useState(() => Boolean(getCheckInPin(checkInListShortId)));
    const [doorSaleOpen, doorSaleHandlers] = useDisclosure(false);
    const [checkInModalOpen, checkInModalHandlers] = useDisclosure(false);
    // On a phone the page is the scanner (Figma 552:3772); its X shows the whole list instead.
    const isPhone = useMediaQuery('(max-width: 767px)');
    const [phoneListOpen, setPhoneListOpen] = useState(false);
    const showPhoneScanner = !!isPhone && !phoneListOpen;
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);

    const products = checkInList?.products;
    const queryFilters: QueryFilters = {
        pageNumber: 1,
        query: searchQueryDebounced,
        perPage: 150,
        filterFields: {
            status: {operator: QueryFilterOperator.Equals, value: 'ACTIVE'},
        },
    };

    const isUnlocked = !checkInList?.requires_pin || hasPin;

    const attendeesQuery = useGetCheckInListAttendees(
        checkInListShortId,
        queryFilters,
        checkInList?.is_active && !checkInList?.is_expired && isUnlocked,
    );
    const attendees = attendeesQuery?.data?.data;
    const checkInMutation = useCreateCheckInPublic(queryFilters);
    const deleteCheckInMutation = useDeleteCheckInPublic(queryFilters);
    const areOfflinePaymentsEnabled = eventSettings?.payment_providers?.includes('OFFLINE');
    const allowOrdersAwaitingOfflinePaymentToCheckIn = areOfflinePaymentsEnabled
        && eventSettings?.allow_orders_awaiting_offline_payment_to_check_in;

    // A stored PIN can go stale when the organizer changes it, so a refusal sends us back to the prompt.
    useEffect(() => {
        if ((attendeesQuery.error as AxiosError)?.response?.status === 401) {
            clearCheckInPin(checkInListShortId);
            setHasPin(false);
            setPinFailed(true);
        }
    }, [attendeesQuery.error, checkInListShortId]);

    // Save sound preference to localStorage
    useEffect(() => {
        if (!isSsr()) {
            localStorage.setItem("scannerSoundOn", JSON.stringify(isSoundOn));
        }
    }, [isSoundOn]);

    // Sound helpers
    const playSuccessSound = useCallback(() => {
        if (isSoundOn && scanSuccessAudioRef.current) {
            scanSuccessAudioRef.current.play().catch(() => {
                // Ignore audio play errors (e.g., user hasn't interacted with page)
            });
        }
    }, [isSoundOn]);

    const playErrorSound = useCallback(() => {
        if (isSoundOn && scanErrorAudioRef.current) {
            scanErrorAudioRef.current.play().catch(() => {
                // Ignore audio play errors (e.g., user hasn't interacted with page)
            });
        }
    }, [isSoundOn]);

    const playClickSound = useCallback(() => {
        if (isSoundOn && scanSuccessAudioRef.current) {
            // Use success sound for click feedback
            scanSuccessAudioRef.current.currentTime = 0; // Reset to start for quick successive clicks
            scanSuccessAudioRef.current.play().catch(() => {
                // Ignore audio play errors
            });
        }
    }, [isSoundOn]);

    // What a scan or a check-in says: in the scanner's sheet on a phone, a notification elsewhere.
    const reportProblem = (message: React.ReactNode) => {
        if (showPhoneScanner) {
            setScanResult({tone: 'problem', title: message});
            return;
        }
        showError(message);
    };

    const attendeeDetail = (attendee: Attendee) => {
        const product = products?.find(item => item.id === attendee.product_id)?.title;
        const bib = attendee.bib_number;
        return [product, bib ? t`Bib ${bib}` : null].filter(Boolean).join(' · ');
    };

    // Resout a true quand l'echec vient du reseau ou du serveur: le meme billet peut etre rescanne.
    const handleCheckInAction = (attendee: Attendee, action: 'check-in' | 'check-in-and-mark-order-as-paid') => new Promise<boolean>((resolve) => {
        checkInMutation.mutate({
            checkInListShortId: checkInListShortId,
            attendeePublicId: attendee.public_id,
            action: action,
        }, {
            onSuccess: ({errors}) => {
                resolve(false);
                if (errors && errors[attendee.public_id]) {
                    reportProblem(errors[attendee.public_id]);
                    playErrorSound();
                    return;
                }
                if (showPhoneScanner) {
                    const name = attendee.first_name;
                    setScanResult({tone: 'ok', title: t`Welcome, ${name}!`, detail: attendeeDetail(attendee)});
                } else {
                    showSuccess(<Trans>{attendee.first_name} <b>checked in</b> successfully</Trans>);
                }
                playSuccessSound();
                CheckInListQuery.refetch();
                checkInModalHandlers.close();
                setSelectedAttendee(null);
            },
            onError: (error) => {
                playErrorSound();
                const retryable = !networkStatus.online || !(error instanceof AxiosError)
                    || !error.response || error.response.status >= 500;
                resolve(retryable);
                if (!networkStatus.online) {
                    reportProblem(t`You are offline`);
                    return;
                }

                if (error instanceof AxiosError) {
                    reportProblem(error?.response?.data?.message || t`Unable to check in attendee`);
                } else {
                    reportProblem(t`Unable to check in attendee`);
                }
            }
        });
    });

    const handleCheckInToggle = (attendee: Attendee) => {
        if (attendee.check_in) {
            deleteCheckInMutation.mutate({
                checkInListShortId: checkInListShortId,
                checkInShortId: attendee.check_in.short_id,
            }, {
                onSuccess: () => {
                    showSuccess(<Trans>{attendee.first_name} <b>checked out</b> successfully</Trans>);
                    playSuccessSound();
                    CheckInListQuery.refetch();
                },
                onError: (error) => {
                    playErrorSound();
                    if (!networkStatus.online) {
                        reportProblem(t`You are offline`);
                        return;
                    }

                    if (error instanceof AxiosError) {
                        showError(error?.response?.data?.message || t`Unable to check out attendee`);
                    } else {
                        showError(t`Unable to check out attendee`);
                    }
                }
            });
            return;
        }

        const isAttendeeAwaitingPayment = attendee.status === 'AWAITING_PAYMENT';

        if (allowOrdersAwaitingOfflinePaymentToCheckIn && isAttendeeAwaitingPayment) {
            setSelectedAttendee(attendee);
            checkInModalHandlers.open();
            return;
        }

        if (!allowOrdersAwaitingOfflinePaymentToCheckIn && isAttendeeAwaitingPayment) {
            reportProblem(t`You cannot check in attendees with unpaid orders. This setting can be changed in the event settings.`);
            return;
        }

        handleCheckInAction(attendee, 'check-in');
    };

    // busy: pas traite (un autre billet est en cours), a relire tout de suite; retry: echec passager
    // (reseau, serveur), a relire apres une courte pause; done: entre ou refuse pour de bon.
    const handleQrCheckIn = useCallback(async (attendeePublicId: string): Promise<ScanOutcome> => {
        // Une reponse definitive ouvre le silence du billet tenu devant la camera.
        const settle = (outcome: ScanOutcome): ScanOutcome => {
            isProcessingRef.current = false;
            if (outcome === 'done') {
                recentScansRef.current.set(attendeePublicId, Date.now());
            }
            return outcome;
        };

        // Occupe par un autre billet: celui-ci n'est pas traite, le scanner le relira.
        if (isProcessingRef.current) {
            return 'busy';
        }

        // Le billet qu'on vient de traiter, encore devant la camera: rien a redire.
        const justCheckedInAt = recentScansRef.current.get(attendeePublicId);
        if (justCheckedInAt && Date.now() - justCheckedInAt < RECENT_SCAN_MS) {
            return 'done';
        }

        // Check if this barcode was recently processed (within last 3 seconds)
        const now = Date.now();
        if (processedBarcodesRef.current.has(attendeePublicId) &&
            now - lastScanTimeRef.current < 3000) {
            reportProblem(t`This ticket was just scanned. Please wait before scanning again.`);
            playErrorSound();
            return 'done';
        }

        isProcessingRef.current = true;
        lastScanTimeRef.current = now;

        // Find the attendee in the current list or fetch them
        let attendee = attendees?.find(a => a.public_id === attendeePublicId);

        if (!attendee) {
            try {
                const {data} = await publicCheckInClient.getCheckInListAttendee(checkInListShortId, attendeePublicId);
                attendee = data;
            } catch (error) {
                const status = (error as AxiosError)?.response?.status;
                const notOnList = status === 404;
                // Comme pour l'enregistrement: seuls le reseau et les pannes du serveur se reessaient.
                const transient = !status || status >= 500;
                reportProblem(notOnList ? t`This ticket is not on this list.` : t`Unable to fetch attendee`);
                playErrorSound();
                return settle(transient ? 'retry' : 'done');
            }

            if (!attendee) {
                reportProblem(t`Attendee not found`);
                playErrorSound();
                return settle('done');
            }
        }

        // Check if already checked in
        if (attendee.check_in) {
            reportProblem(<Trans>{attendee.first_name} {attendee.last_name} is already checked in</Trans>);
            playErrorSound();
            processedBarcodesRef.current.add(attendeePublicId);
            return settle('done');
        }

        const isAttendeeAwaitingPayment = attendee.status === 'AWAITING_PAYMENT';

        if (allowOrdersAwaitingOfflinePaymentToCheckIn && isAttendeeAwaitingPayment) {
            setSelectedAttendee(attendee);
            checkInModalHandlers.open();
            return settle('done');
        }

        if (!allowOrdersAwaitingOfflinePaymentToCheckIn && isAttendeeAwaitingPayment) {
            reportProblem(t`You cannot check in attendees with unpaid orders. This setting can be changed in the event settings.`);
            playErrorSound();
            return settle('done');
        }

        // Add to processed set before making the request
        processedBarcodesRef.current.add(attendeePublicId);

        // Clear old entries from the set after 10 seconds
        setTimeout(() => {
            processedBarcodesRef.current.delete(attendeePublicId);
        }, 10000);

        const retryable = await handleCheckInAction(attendee, 'check-in');
        if (retryable) {
            processedBarcodesRef.current.delete(attendeePublicId);
        }
        return settle(retryable ? 'retry' : 'done');
    }, [attendees, checkInListShortId, allowOrdersAwaitingOfflinePaymentToCheckIn, checkInModalHandlers, handleCheckInAction, playErrorSound]);


    // Process completed barcode
    const processBarcode = useCallback((barcode: string) => {
        if (barcode.startsWith('A-') && barcode.length > 3) {
            handleQrCheckIn(barcode);
        }
    }, [handleQrCheckIn]);

    // Track page focus
    useEffect(() => {
        const handleFocus = () => setPageHasFocus(true);
        const handleBlur = () => setPageHasFocus(false);

        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    // Global keyboard listener for HID scanner mode
    useEffect(() => {
        if (!hidScannerMode) return;

        const handleKeyPress = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input field
            if (e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if (e.key === 'Enter') {
                // Process the accumulated barcode on Enter
                if (currentBarcode.length > 0) {
                    processBarcode(currentBarcode);
                    setCurrentBarcode('');
                }
            } else if (e.key.length === 1) {
                // Accumulate characters
                setCurrentBarcode(prev => {
                    const newBarcode = prev + e.key;

                    // Clear any existing timeout
                    if (barcodeTimeoutRef.current) {
                        clearTimeout(barcodeTimeoutRef.current);
                    }

                    // Set timeout to clear barcode if no more input (scanner stopped)
                    barcodeTimeoutRef.current = setTimeout(() => {
                        // Auto-process if it looks like a complete barcode
                        if (newBarcode.startsWith('A-') && newBarcode.length > 3) {
                            processBarcode(newBarcode);
                        }
                        setCurrentBarcode('');
                    }, 100);

                    return newBarcode;
                });
            }
        };

        window.addEventListener('keypress', handleKeyPress);

        return () => {
            window.removeEventListener('keypress', handleKeyPress);
            if (barcodeTimeoutRef.current) {
                clearTimeout(barcodeTimeoutRef.current);
            }
        };
    }, [hidScannerMode, currentBarcode, processBarcode]);

    const eventLine = event
        ? [event.title, event.start_date && new Intl.DateTimeFormat(intlLocale(), {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            timeZone: event.timezone,
        }).format(new Date(event.start_date))].filter(Boolean).join(' · ')
        : undefined;

    if (CheckInListQuery.error && (CheckInListQuery.error as any).response?.status === 404) {
        return (
            <NoResultsSplash
                heading={t`Check-in list not found`}
                imageHref={'/blank-slate/check-in-lists.svg'}
                subHeading={(
                    <>
                        <p>
                            {t`The check-in list you are looking for does not exist.`}
                        </p>
                    </>
                )}
            />)
    }

    // Outside its hours, a list shows « Liste fermée » (Figma: notes of Accueil et scan).
    if (checkInList?.is_expired || (checkInList && !checkInList.is_active)) {
        return (
            <ListIntro listName={checkInList.name} eventLine={eventLine} description={checkInList.description}>
                <p className={scannerClasses.closedTitle}>{t`List closed`}</p>
                {checkInList.is_expired ? (
                    <p className={scannerClasses.closedText}>{t`This list no longer accepts scans.`}</p>
                ) : (
                    <p className={scannerClasses.closedText}>
                        {t`It opens in`}{' '}
                        <b>
                            <Countdown
                                targetDate={checkInList.activates_at as string}
                                onExpiry={() => CheckInListQuery.refetch()}
                            />
                        </b>
                    </p>
                )}
            </ListIntro>
        );
    }

    if (checkInList?.requires_pin && !hasPin) {
        return (
            <PinScreen
                key={String(pinFailed)}
                listName={checkInList.name}
                eventLine={eventLine}
                description={checkInList.description}
                length={checkInList.pin_length}
                hasFailed={pinFailed}
                onSubmit={async (pin) => {
                    setCheckInPin(checkInListShortId, pin);
                    try {
                        await publicCheckInClient.getCheckInListAttendees(checkInListShortId as string, {pageNumber: 1, perPage: 1});
                        setHasPin(true);
                        setPinFailed(false);
                        return true;
                    } catch (error) {
                        clearCheckInPin(checkInListShortId);
                        if ((error as AxiosError)?.response?.status !== 401) {
                            reportProblem(t`Unable to check the PIN. Please try again.`);
                        }
                        return false;
                    }
                }}
            />
        );
    }

    const checkedIn = checkInList?.checked_in_attendees ?? 0;
    const total = checkInList?.total_attendees ?? 0;
    const percentage = total > 0 ? Math.min(100, checkedIn / total * 100) : 0;
    // The attendee whose button is working (the others stay usable-looking but wait their turn).
    const pendingAttendeeId = checkInMutation.isPending
        ? String(checkInMutation.variables?.attendeePublicId)
        : deleteCheckInMutation.isPending
            ? attendees?.find(attendee => attendee.check_in?.short_id === deleteCheckInMutation.variables?.checkInShortId)?.public_id
            : undefined;

    const attendeeList = (
        <AttendeeList
            attendees={attendees}
            products={products}
            isLoading={attendeesQuery.isLoading}
            pendingAttendeeId={pendingAttendeeId}
            isBusy={checkInMutation.isPending || deleteCheckInMutation.isPending}
            allowOrdersAwaitingOfflinePaymentToCheckIn={allowOrdersAwaitingOfflinePaymentToCheckIn || false}
            onCheckInToggle={handleCheckInToggle}
            onClickSound={playClickSound}
        />
    );

    return (
        <div className={classes.page}>
            {showPhoneScanner && (
                <PhoneScanner
                    listName={checkInList?.name}
                    eventTitle={event?.title}
                    description={checkInList?.description}
                    checkedIn={checkedIn}
                    total={total}
                    result={scanResult}
                    query={searchQuery}
                    onQueryChange={setSearchQuery}
                    searchResults={attendeeList}
                    onSell={checkInList?.allow_door_sales ? () => doorSaleHandlers.open() : undefined}
                    onScan={(code) => code.startsWith('A-')
                        ? handleQrCheckIn(code)
                        : reportProblem(t`This code is not a ticket.`)}
                    onClose={() => setPhoneListOpen(true)}
                />
            )}
            {!showPhoneScanner && <div className={classes.inner}>
                <header className={classes.top}>
                    <span className={classes.wordmark} aria-hidden>
                        <span>{'Billetterie'}</span>
                        <span>{'Dehors'}</span>
                    </span>
                    <div className={classes.topActions}>
                        {!networkStatus.online && (
                            <span className={classes.offline}>
                                <IconWifiOff size={16} stroke={2.25}/>
                                {t`Offline`}
                            </span>
                        )}
                        <UnstyledButton
                            className={classes.roundButton}
                            aria-label={isSoundOn ? t`Turn sound off` : t`Turn sound on`}
                            aria-pressed={isSoundOn}
                            onClick={() => setIsSoundOn(!isSoundOn)}
                        >
                            {isSoundOn ? <IconVolume size={22}/> : <IconVolumeOff size={22}/>}
                        </UnstyledButton>
                    </div>
                </header>

                <section className={classes.hero}>
                    {event?.title && <span className={classes.overline}>{event.title}</span>}
                    <h1 className={classes.title}>{checkInList?.name}</h1>
                    {checkInList?.description && <p className={classes.description}>{checkInList.description}</p>}
                    {checkInList && isUnlocked && (
                        <div className={classes.progress}>
                            <div className={classes.count}>
                                <span className={classes.countValue}>{checkedIn}</span>
                                <span className={classes.countTotal}>/ {total}</span>
                                <span className={classes.countLabel}>
                                    {t({message: 'checked in', context: 'check-in list count'})}
                                </span>
                            </div>
                            <span
                                className={classes.bar}
                                data-level={total > 0 && checkedIn >= total ? 'done' : undefined}
                                role="progressbar"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={Math.round(percentage)}
                            >
                                <span style={{width: `${percentage}%`}}/>
                            </span>
                        </div>
                    )}
                </section>

                <div className={classes.toolbar}>
                    <div className={classes.search}>
                        <SearchBar
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            onClear={() => setSearchQuery('')}
                            placeholder={t`Search by name, order #, attendee # or email...`}
                        />
                    </div>
                    <Button
                        className={classes.scanButton}
                        leftSection={<IconQrcode size={22}/>}
                        aria-label={t`Scan`}
                        onClick={() => isPhone ? setPhoneListOpen(false) : setScannerSelectionOpen(true)}
                    >
                        <span className={classes.buttonLabel}>{t`Scan`}</span>
                    </Button>
                    {checkInList?.allow_door_sales && (
                        <Button
                            className={classes.saleButton}
                            leftSection={<IconShoppingCart size={22}/>}
                            aria-label={t`Sell a ticket`}
                            onClick={() => doorSaleHandlers.open()}
                        >
                            <span className={classes.buttonLabel}>{t`Sell a ticket`}</span>
                        </Button>
                    )}
                </div>

                <HidScannerStatus
                    isActive={hidScannerMode}
                    pageHasFocus={pageHasFocus}
                    onDisable={() => setHidScannerMode(false)}
                />

                {attendeeList}
            </div>}
            <CheckInOptionsModal
                isOpen={checkInModalOpen}
                attendee={selectedAttendee}
                isPending={checkInMutation.isPending}
                onClose={() => {
                    checkInModalHandlers.close();
                    setSelectedAttendee(null);
                }}
                onCheckIn={(action) => selectedAttendee && handleCheckInAction(selectedAttendee, action)}
            />
            <ScannerSelectionModal
                isOpen={scannerSelectionOpen}
                isHidScannerActive={hidScannerMode}
                onClose={() => setScannerSelectionOpen(false)}
                onCameraSelect={() => {
                    setScannerSelectionOpen(false);
                    setQrScannerOpen(true);
                }}
                onHidScannerSelect={() => {
                    setScannerSelectionOpen(false);
                    if (!hidScannerMode) {
                        setHidScannerMode(true);
                    }
                }}
            />
            {qrScannerOpen && (
                <Modal.Root
                    opened
                    onClose={() => setQrScannerOpen(false)}
                    fullScreen
                    radius={0}
                    transitionProps={{transition: 'fade', duration: 200}}
                    padding={'none'}
                >
                    <Modal.Overlay/>
                    <Modal.Content>
                        <QRScannerComponent
                            onAttendeeScanned={handleQrCheckIn}
                            onClose={() => setQrScannerOpen(false)}
                            isSoundOn={isSoundOn}
                        />
                    </Modal.Content>
                </Modal.Root>
            )}
            {checkInList?.allow_door_sales && (
                <DoorSaleModal
                    isOpen={doorSaleOpen}
                    checkInListShortId={checkInListShortId as string}
                    currency={event?.currency as string}
                    onClose={() => {
                        doorSaleHandlers.close();
                        CheckInListQuery.refetch();
                    }}
                />
            )}
            {/* Audio elements for HID scanner sounds */}
            <audio ref={scanSuccessAudioRef} src="/sounds/scan-success.wav"/>
            <audio ref={scanErrorAudioRef} src="/sounds/scan-error.wav"/>
        </div>
    );
}

export default CheckIn;
