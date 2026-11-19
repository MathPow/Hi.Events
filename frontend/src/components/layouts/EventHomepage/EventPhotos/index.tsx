import {useRef, useState} from "react";
import {t} from "@lingui/macro";
import {Image} from "../../../../types.ts";
import {PublicIcon} from "../../../common/PublicIcon";
import page from "../EventPage.module.scss";
import classes from "./EventPhotos.module.scss";

// Past this many photos, a counter replaces the dots under the cover.
const MAX_DOTS = 7;
// The grid shows five photos; the fifth tells how many more there are.
const GRID_PHOTOS = 5;

interface CoverPhotosProps {
    photos: Image[];
    title: string;
    onOpen: (index: number) => void;
}

// The cover, then the event's photos, swiped sideways in the same frame.
export const CoverPhotos = ({photos, title, onOpen}: CoverPhotosProps) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [index, setIndex] = useState(0);

    if (photos.length === 1) {
        const [photo] = photos;
        return (
            <>
                {photo.lqip_base64 && <img src={photo.lqip_base64} alt="" aria-hidden className={page.coverLqip}/>}
                <img src={photo.url} alt={title} className={page.coverImage}/>
            </>
        );
    }

    const total = photos.length;

    const goTo = (target: number) => {
        const track = trackRef.current;
        if (track) {
            track.scrollTo({left: Math.max(0, Math.min(photos.length - 1, target)) * track.clientWidth, behavior: 'smooth'});
        }
    };

    return (
        <>
            <div
                ref={trackRef}
                className={classes.track}
                onScroll={(scrollEvent) => {
                    const track = scrollEvent.currentTarget;
                    setIndex(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)));
                }}
            >
                {photos.map((photo, photoIndex) => {
                    const number = photoIndex + 1;
                    return (
                        <button
                            key={photo.id}
                            type="button"
                            className={classes.slide}
                            onClick={() => onOpen(photoIndex)}
                            aria-label={t`See photo ${number} of ${total}`}
                        >
                            {photo.lqip_base64 && <img src={photo.lqip_base64} alt="" aria-hidden className={page.coverLqip}/>}
                            <img
                                src={photo.url}
                                alt={photoIndex === 0 ? title : ''}
                                className={page.coverImage}
                                loading={photoIndex === 0 ? undefined : 'lazy'}
                                draggable={false}
                            />
                        </button>
                    );
                })}
            </div>

            {photos.length <= MAX_DOTS ? (
                <div className={classes.dots} aria-hidden>
                    {photos.map((photo, photoIndex) => (
                        <span key={photo.id} className={classes.dot} data-active={photoIndex === index || undefined}/>
                    ))}
                </div>
            ) : (
                <span className={classes.counter} aria-hidden>{index + 1} / {photos.length}</span>
            )}

            <button type="button" className={`${classes.arrow} ${classes.previous}`} onClick={() => goTo(index - 1)}
                    disabled={index === 0} aria-label={t`Previous photo`}>
                <PublicIcon name={'chevron-droite'} size={18}/>
            </button>
            <button type="button" className={`${classes.arrow} ${classes.next}`} onClick={() => goTo(index + 1)}
                    disabled={index === photos.length - 1} aria-label={t`Next photo`}>
                <PublicIcon name={'chevron-droite'} size={18}/>
            </button>
        </>
    );
};

interface PhotoGridProps {
    photos: Image[];
    onOpen: (index: number) => void;
}

// The photos under the description, as a mosaic: one to five tiles, « +3 » on the last when there are more.
export const PhotoGrid = ({photos, onOpen}: PhotoGridProps) => {
    const shown = photos.slice(0, GRID_PHOTOS);
    const total = photos.length;
    const hidden = total - shown.length;

    return (
        <div className={classes.grid} data-count={shown.length}>
            {shown.map((photo, photoIndex) => {
                const more = hidden > 0 && photoIndex === shown.length - 1;
                const number = photoIndex + 1;
                return (
                    <button
                        key={photo.id}
                        type="button"
                        className={classes.tile}
                        style={photo.avg_colour ? {backgroundColor: photo.avg_colour} : undefined}
                        onClick={() => onOpen(photoIndex)}
                        aria-label={more ? t`See all ${total} photos` : t`See photo ${number} of ${total}`}
                    >
                        <img src={photo.url} alt="" loading="lazy" className={classes.tileImage} draggable={false}/>
                        {more && <span className={classes.more} aria-hidden>+{hidden}</span>}
                    </button>
                );
            })}
        </div>
    );
};
