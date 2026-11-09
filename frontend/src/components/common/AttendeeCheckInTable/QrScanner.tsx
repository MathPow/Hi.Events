import {useEffect, useRef, useState} from 'react';
import QrScanner from 'qr-scanner';
import {useDebouncedValue} from '@mantine/hooks';
import classes from './QrScanner.module.scss';
import {showError} from "../../../utilites/notifications.tsx";
import {t} from "@lingui/macro";
import {QrScannerControls} from './QrScannerControls';
import {PermissionDeniedMessage} from './PermissionDeniedMessage';

interface QRScannerComponentProps {
    // true: echec passager, le billet peut etre rescanne.
    onAttendeeScanned: (attendeePublicId: string) => void | Promise<boolean | void>;
    onClose: () => void;
    isSoundOn?: boolean;
}

export const QRScannerComponent = (props: QRScannerComponentProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const qrScannerRef = useRef<QrScanner | null>(null);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [isFlashAvailable, setIsFlashAvailable] = useState(false);
    const [isFlashOn, setIsFlashOn] = useState(false);
    const [cameraList, setCameraList] = useState<QrScanner.Camera[]>();
    const [processedAttendeeIds, setProcessedAttendeeIds] = useState<string[]>([]);
    const latestProcessedAttendeeIdsRef = useRef<string[]>([]);
    const inFlightAttendeeIdRef = useRef<string | null>(null);

    const [currentAttendeeId, setCurrentAttendeeId] = useState<string | null>(null);
    const [debouncedAttendeeId] = useDebouncedValue(currentAttendeeId, 1000);
    const [isScanFailed, setIsScanFailed] = useState(false);

    const scanErrorAudioRef = useRef<HTMLAudioElement | null>(null);
    const scanInProgressAudioRef = useRef<HTMLAudioElement | null>(null);

    const [isSoundOn, setIsSoundOn] = useState(() => {
        // Use the prop value if provided, otherwise fallback to unified storage
        if (props.isSoundOn !== undefined) {
            return props.isSoundOn;
        }
        const storedIsSoundOn = localStorage.getItem("scannerSoundOn");
        return storedIsSoundOn === null ? true : JSON.parse(storedIsSoundOn);
    });

    // Sync with prop changes
    useEffect(() => {
        if (props.isSoundOn !== undefined) {
            setIsSoundOn(props.isSoundOn);
        }
    }, [props.isSoundOn]);

    useEffect(() => {
        // Only save to localStorage if not controlled by props
        if (props.isSoundOn === undefined) {
            localStorage.setItem("scannerSoundOn", JSON.stringify(isSoundOn));
        }
    }, [isSoundOn, props.isSoundOn]);

    useEffect(() => {
        latestProcessedAttendeeIdsRef.current = processedAttendeeIds;
    }, [processedAttendeeIds]);

    const startScanner = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({video: true});
            setPermissionGranted(true);
            if (videoRef.current) {
                qrScannerRef.current = new QrScanner(videoRef.current, (result) => {
                    setCurrentAttendeeId(result.data);
                }, {
                    maxScansPerSecond: 1,
                });
                qrScannerRef.current.start();
            }
        } catch (error) {
            setPermissionDenied(true);
            console.error(error);
        }
    };

    useEffect(() => {
        if (debouncedAttendeeId) {
            const latestProcessedAttendeeIds = latestProcessedAttendeeIdsRef.current;
            const alreadyScanned = latestProcessedAttendeeIds.includes(debouncedAttendeeId);

            // Occupe (ou ce billet est en cours d'enregistrement): on oublie cette lecture pour que
            // le billet tenu devant la camera soit relu ensuite, sans faux « deja scanne ».
            if (isScanFailed || isCheckingIn || inFlightAttendeeIdRef.current === debouncedAttendeeId) {
                setCurrentAttendeeId(null);
                return;
            }

            if (alreadyScanned) {
                showError(t`You already scanned this ticket`);

                setIsScanFailed(true);
                setTimeout(() => setIsScanFailed(false), 500);
                if (isSoundOn && scanErrorAudioRef.current) {
                    scanErrorAudioRef.current.play();
                }

                return;
            }

            if (!isCheckingIn && !alreadyScanned) {
                setIsCheckingIn(true);
                if (isSoundOn && scanInProgressAudioRef.current) {
                    scanInProgressAudioRef.current.play();
                }

                // L'entree (ou son refus) est annoncee par l'ecran d'enregistrement, une fois la
                // reponse du serveur recue: pas de vert ni de son de reussite avant.
                const scannedId = debouncedAttendeeId;
                inFlightAttendeeIdRef.current = scannedId;
                setProcessedAttendeeIds(prevIds => [...prevIds, scannedId]);
                setCurrentAttendeeId(null);
                Promise.resolve(props.onAttendeeScanned(scannedId)).then((retryable) => {
                    if (retryable) {
                        setProcessedAttendeeIds(prevIds => prevIds.filter(id => id !== scannedId));
                    }
                }).finally(() => {
                    inFlightAttendeeIdRef.current = null;
                    setIsCheckingIn(false);
                });
            }
        }
    }, [debouncedAttendeeId]);

    const stopScanner = () => {
        if (qrScannerRef.current) {
            qrScannerRef.current.stop();
            qrScannerRef.current.destroy();
            qrScannerRef.current = null;
        }
    };

    const handleClose = () => {
        stopScanner();
        props.onClose();
    };

    const handleFlashToggle = () => {
        if (!isFlashAvailable) {
            showError(t`Flash is not available on this device`);
            return;
        }
        if (qrScannerRef.current) {
            if (isFlashOn) {
                qrScannerRef.current.turnFlashOff();
            } else {
                qrScannerRef.current.turnFlashOn();
            }
            setIsFlashOn(!isFlashOn);
        }
    };

    const handleSoundToggle = () => {
        setIsSoundOn(!isSoundOn);
    };

    const requestPermission = async () => {
        setPermissionDenied(false);
        await startScanner();
    };

    const updateFlashAvailability = async () => {
        if (qrScannerRef.current) {
            const hasFlash = await qrScannerRef.current.hasFlash();
            setIsFlashAvailable(hasFlash);
        }
    };

    useEffect(() => {
        startScanner().then(() => {
            updateFlashAvailability().catch(console.error);
            QrScanner.listCameras(true)
                .then(cameras => setCameraList(cameras));
        });

        return () => {
            if (permissionGranted) {
                stopScanner();
            }
        };
    }, []);

    const handleCameraSelection = (camera: QrScanner.Camera) => {
        return qrScannerRef.current?.setCamera(camera.id)
            .then(() => updateFlashAvailability().catch(console.error));
    };

    return (
        <div className={classes.videoContainer}>
            {permissionDenied && (
                <PermissionDeniedMessage
                    onRequestPermission={requestPermission}
                    onClose={handleClose}
                />
            )}

            <video className={classes.video} ref={videoRef}></video>

            <QrScannerControls
                isFlashAvailable={isFlashAvailable}
                isFlashOn={isFlashOn}
                isSoundOn={isSoundOn}
                cameraList={cameraList}
                onFlashToggle={handleFlashToggle}
                onSoundToggle={handleSoundToggle}
                onCameraSelect={handleCameraSelection}
                onClose={handleClose}
            />

            <audio ref={scanErrorAudioRef} src="/sounds/scan-error.wav"/>
            <audio ref={scanInProgressAudioRef} src="/sounds/scan-in-progress.wav"/>
            
            <div className={`${classes.scannerOverlay} ${isScanFailed ? classes.failure : ""} ${isCheckingIn ? classes.checkingIn : ""}`}/>
        </div>
    );
};
