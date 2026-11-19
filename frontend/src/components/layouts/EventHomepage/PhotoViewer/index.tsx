import {useCallback, useEffect, useRef, useState} from "react";
import {Modal} from "@mantine/core";
import {t} from "@lingui/macro";
import {IconX} from "@tabler/icons-react";
import {Image} from "../../../../types.ts";
import {PublicIcon} from "../../../common/PublicIcon";
import classes from "./PhotoViewer.module.scss";

interface PhotoViewerProps {
    photos: Image[];
    // The photo shown first; null closes the viewer.
    startIndex: number | null;
    onClose: () => void;
}

// The event's photos full screen: swiped on a phone, arrows and the keyboard on a computer.
export const PhotoViewer = ({photos, startIndex, onClose}: PhotoViewerProps) => {
    const trackRef = useRef<HTMLDivElement | null>(null);
    const [index, setIndex] = useState(startIndex ?? 0);
    const opened = startIndex !== null;

    // Opens on the chosen photo; stable, so scrolling doesn't bring it back there.
    const placeTrack = useCallback((node: HTMLDivElement | null) => {
        trackRef.current = node;
        if (node && startIndex !== null) {
            node.scrollLeft = startIndex * node.clientWidth;
        }
    }, [startIndex]);

    const goTo = (target: number) => {
        const track = trackRef.current;
        if (track) {
            track.scrollTo({left: Math.max(0, Math.min(photos.length - 1, target)) * track.clientWidth, behavior: 'smooth'});
        }
    };

    useEffect(() => {
        if (startIndex !== null) {
            setIndex(startIndex);
        }
    }, [startIndex]);

    useEffect(() => {
        if (!opened) {
            return;
        }
        const handleKey = (keyEvent: KeyboardEvent) => {
            if (keyEvent.key === 'ArrowRight') {
                goTo(index + 1);
            } else if (keyEvent.key === 'ArrowLeft') {
                goTo(index - 1);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [opened, index]);

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            fullScreen
            withCloseButton={false}
            padding={0}
            transitionProps={{transition: 'fade', duration: 150}}
            classNames={{content: classes.content, body: classes.body}}
            title={t`Photos`}
            styles={{header: {display: 'none'}}}
        >
            <div
                ref={placeTrack}
                className={classes.track}
                onScroll={(scrollEvent) => {
                    const track = scrollEvent.currentTarget;
                    setIndex(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)));
                }}
            >
                {photos.map((photo, photoIndex) => (
                    <div key={photo.id} className={classes.slide}>
                        <img
                            src={photo.url}
                            alt=""
                            className={classes.image}
                            loading={Math.abs(photoIndex - (startIndex ?? 0)) > 1 ? 'lazy' : undefined}
                            draggable={false}
                        />
                    </div>
                ))}
            </div>

            <div className={classes.top}>
                <span className={classes.counter} aria-live="polite">{index + 1} / {photos.length}</span>
                <button type="button" className={classes.button} data-rough="button" onClick={onClose} aria-label={t`Close`}>
                    <IconX size={22} stroke={2.25}/>
                </button>
            </div>

            {photos.length > 1 && (
                <>
                    <button type="button" className={`${classes.button} ${classes.arrow} ${classes.previous}`} data-rough="button"
                            onClick={() => goTo(index - 1)} disabled={index === 0} aria-label={t`Previous photo`}>
                        <PublicIcon name={'chevron-droite'} size={20}/>
                    </button>
                    <button type="button" className={`${classes.button} ${classes.arrow} ${classes.next}`} data-rough="button"
                            onClick={() => goTo(index + 1)} disabled={index === photos.length - 1} aria-label={t`Next photo`}>
                        <PublicIcon name={'chevron-droite'} size={20}/>
                    </button>
                </>
            )}
        </Modal>
    );
};
