import {useState} from "react";
import {t} from "@lingui/macro";
import {Dropzone, FileRejection, IMAGE_MIME_TYPE} from "@mantine/dropzone";
import {IconX} from "@tabler/icons-react";
import {GalleryDraftImage} from "./eventPageDraft.ts";
import designer from "../../organizer/OrganizerHomepageDesigner/OrganizerHomepageDesigner.module.scss";
import classes from "./GalleryPicker.module.scss";

// The server's limits (CreateImageHandler::MAX_EVENT_GALLERY_IMAGES, ImageType::getMinimumDimensionsMap),
// checked here right away since the photos are only uploaded when publishing.
export const MAX_GALLERY_IMAGES = 20;
const MAX_UPLOAD_SIZE = 30 * 1024 * 1024;
const MIN_SIZE = 300;

const imageSize = (url: string) => new Promise<{ width: number, height: number }>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve({width: image.naturalWidth, height: image.naturalHeight});
    image.onerror = reject;
    image.src = url;
});

interface GalleryPickerProps {
    images: GalleryDraftImage[];
    onChange: (images: GalleryDraftImage[]) => void;
    disabled?: boolean;
}

export const GalleryPicker = ({images, onChange, disabled}: GalleryPickerProps) => {
    const [error, setError] = useState<string | null>(null);
    const room = MAX_GALLERY_IMAGES - images.length;

    const add = async (files: File[]) => {
        const added: GalleryDraftImage[] = [];
        let problem: string | null = null;

        for (const file of files) {
            if (added.length >= room) {
                problem = t`An event can have up to ${MAX_GALLERY_IMAGES} photos.`;
                break;
            }
            if (file.size > MAX_UPLOAD_SIZE) {
                problem = t`File is too large. Maximum size is 30MB.`;
                continue;
            }
            const url = URL.createObjectURL(file);
            try {
                const {width, height} = await imageSize(url);
                if (width < MIN_SIZE || height < MIN_SIZE) {
                    URL.revokeObjectURL(url);
                    const minWidth = MIN_SIZE, minHeight = MIN_SIZE;
                    problem = t`This image is too small: at least ${minWidth} × ${minHeight} px.`;
                    continue;
                }
            } catch {
                URL.revokeObjectURL(url);
                problem = t`Invalid file type. Please upload an image.`;
                continue;
            }
            added.push({kind: 'new', file, url});
        }

        setError(problem);
        if (added.length > 0) {
            onChange([...images, ...added]);
        }
    };

    const remove = (image: GalleryDraftImage) => {
        if (image.kind === 'new') {
            URL.revokeObjectURL(image.url);
        }
        setError(null);
        onChange(images.filter(other => other !== image));
    };

    const handleReject = (rejections: FileRejection[]) => {
        const code = rejections[0]?.errors[0]?.code;
        setError(code === 'file-too-large'
            ? t`File is too large. Maximum size is 30MB.`
            : t`Invalid file type. Please upload an image.`);
    };

    return (
        <div className={`${designer.imageBlock} ${classes.gallery}`}>
            <p className={designer.fieldLabel}>{t`Photos`}</p>
            <p className={designer.fieldHint}>
                {t`Up to ${MAX_GALLERY_IMAGES} photos. They follow the cover at the top of the page and appear under the description.`}
            </p>

            <div className={classes.grid}>
                {images.map((image, index) => {
                    const number = index + 1;
                    return (
                        <div key={image.url} className={classes.tile}>
                            <img src={image.url} alt="" className={classes.thumbnail}/>
                            <button type="button" className={classes.remove} disabled={disabled}
                                    aria-label={t`Remove photo ${number}`} onClick={() => remove(image)}>
                                <IconX size={14} stroke={2.5}/>
                            </button>
                        </div>
                    );
                })}

                {room > 0 && (
                    <Dropzone
                        onDrop={add}
                        onReject={handleReject}
                        accept={IMAGE_MIME_TYPE}
                        maxSize={MAX_UPLOAD_SIZE}
                        multiple
                        disabled={disabled}
                        className={`${designer.dropzone} ${classes.add}`}
                    >
                        <div className={classes.addContent}>
                            <span className={classes.plus} aria-hidden>+</span>
                            {t`Add photos`}
                        </div>
                    </Dropzone>
                )}
            </div>

            {error && <p className={designer.imageError} role="alert">{error}</p>}
        </div>
    );
};
