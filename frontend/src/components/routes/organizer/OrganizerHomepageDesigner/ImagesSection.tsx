import {useRef, useState} from "react";
import {t} from "@lingui/macro";
import {Dropzone, FileRejection, IMAGE_MIME_TYPE} from "@mantine/dropzone";
import {IconHelp} from "@tabler/icons-react";
import {Tooltip} from "../../../common/Tooltip";
import {DraftImage} from "./homepageDraft.ts";
import classes from "./OrganizerHomepageDesigner.module.scss";

const MAX_UPLOAD_SIZE = 30 * 1024 * 1024;

// The minimum sizes checked by the server (ImageType::getMinimumDimensionsMap), checked here
// right away since the image is only uploaded when publishing.
const MIN_SIZE = {
    cover: {width: 600, height: 50},
    logo: {width: 100, height: 100},
};

const imageSize = (url: string) => new Promise<{ width: number, height: number }>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve({width: image.naturalWidth, height: image.naturalHeight});
    image.onerror = reject;
    image.src = url;
});

export interface ImagePickerProps {
    kind: 'cover' | 'logo';
    label: string;
    recommendation: string;
    image: DraftImage;
    onChange: (image: DraftImage) => void;
    disabled?: boolean;
}

export const ImagePicker = ({kind, label, recommendation, image, onChange, disabled}: ImagePickerProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);

    const pick = async (file?: File) => {
        if (!file) {
            return;
        }
        if (file.size > MAX_UPLOAD_SIZE) {
            setError(t`File is too large. Maximum size is 30MB.`);
            return;
        }
        const url = URL.createObjectURL(file);
        try {
            const {width, height} = await imageSize(url);
            const {width: minWidth, height: minHeight} = MIN_SIZE[kind];
            if (width < minWidth || height < minHeight) {
                URL.revokeObjectURL(url);
                setError(t`This image is too small: at least ${minWidth} × ${minHeight} px.`);
                return;
            }
        } catch {
            URL.revokeObjectURL(url);
            setError(t`Invalid file type. Please upload an image.`);
            return;
        }
        setError(null);
        onChange({kind: 'new', file, url});
    };

    const handleReject = (rejections: FileRejection[]) => {
        const code = rejections[0]?.errors[0]?.code;
        setError(code === 'file-too-large'
            ? t`File is too large. Maximum size is 30MB.`
            : t`Invalid file type. Please upload an image.`);
    };

    const actions = (
        <div className={classes.imageActions}>
            <button type="button" className={classes.textButton} disabled={disabled}
                    onClick={() => inputRef.current?.click()}>
                {t`Replace`}
            </button>
            <button type="button" className={`${classes.textButton} ${classes.removeButton}`}
                    disabled={disabled} onClick={() => {
                setError(null);
                onChange(null);
            }}>
                {t`Remove`}
            </button>
        </div>
    );

    const dropzone = (
        <Dropzone
            onDrop={([file]) => pick(file)}
            onReject={handleReject}
            accept={IMAGE_MIME_TYPE}
            maxSize={MAX_UPLOAD_SIZE}
            multiple={false}
            disabled={disabled}
            className={`${classes.dropzone} ${kind === 'logo' ? classes.logoDropzone : ''}`}
        >
            <div className={classes.dropzoneEmpty}>
                {t`Add an image`}
                <span className={classes.dropzoneHint}>{t`Images only · Max 30MB`}</span>
            </div>
        </Dropzone>
    );

    return (
        <div className={classes.imageBlock}>
            <div className={classes.imageLabel}>
                <p className={classes.fieldLabel}>{label}</p>
                <Tooltip label={recommendation}>
                    <IconHelp size={18} stroke={2} aria-label={recommendation}/>
                </Tooltip>
            </div>

            {!image && dropzone}
            {image && kind === 'cover' && (
                <>
                    <img src={image.url} alt="" className={classes.coverPreview}/>
                    {actions}
                </>
            )}
            {image && kind === 'logo' && (
                <div className={classes.logoRow}>
                    <img src={image.url} alt="" className={classes.logoPreview}/>
                    {actions}
                </div>
            )}
            <input
                ref={inputRef}
                type="file"
                accept={IMAGE_MIME_TYPE.join(',')}
                hidden
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    pick(file);
                }}
            />

            {error && <p className={classes.imageError} role="alert">{error}</p>}
        </div>
    );
};

interface ImagesSectionProps {
    cover: DraftImage;
    logo: DraftImage;
    onChange: (key: 'cover' | 'logo', image: DraftImage) => void;
    disabled?: boolean;
}

export const ImagesSection = ({cover, logo, onChange, disabled}: ImagesSectionProps) => (
    <>
        <ImagePicker
            kind="cover"
            label={t`Cover Image`}
            recommendation={t`We recommend dimensions of 1950px by 650px, a ratio of 3:1, and a maximum file size of 30MB`}
            image={cover}
            onChange={(image) => onChange('cover', image)}
            disabled={disabled}
        />
        <ImagePicker
            kind="logo"
            label={t`Logo`}
            recommendation={t`We recommend dimensions of 400px by 400px, and a maximum file size of 30MB`}
            image={logo}
            onChange={(image) => onChange('logo', image)}
            disabled={disabled}
        />
    </>
);
