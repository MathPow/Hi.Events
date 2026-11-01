import {CSSProperties, useEffect, useRef, useState} from "react";
import {t} from "@lingui/macro";
import {Modal} from "@mantine/core";
import {useElementSize} from "@mantine/hooks";
import {IconDeviceDesktop, IconDeviceMobile} from "@tabler/icons-react";
import {
    ORGANIZER_PREVIEW_MESSAGE,
    ORGANIZER_PREVIEW_READY,
    OrganizerPreviewDraft
} from "../../../layouts/OrganizerHomepagePreview/previewMessages.ts";
import classes from "./OrganizerHomepageDesigner.module.scss";

// The public page as seen on a 1440px screen and on a 402px phone (the mockup frames).
const DESKTOP_WIDTH = 1440;
const PHONE = {width: 402, height: 874};

interface PreviewFrameProps {
    src: string;
    draft: OrganizerPreviewDraft;
    className: string;
    style?: CSSProperties;
}

// The public page in an iframe, which shows the draft: it is sent again on every change.
const PreviewFrame = ({src, draft, className, style}: PreviewFrameProps) => {
    const frame = useRef<HTMLIFrameElement>(null);
    const latest = useRef(draft);
    latest.current = draft;

    const send = () => frame.current?.contentWindow?.postMessage(
        {type: ORGANIZER_PREVIEW_MESSAGE, draft: latest.current},
        window.location.origin,
    );

    useEffect(send, [draft]);

    // Like a page seen in a phone or a screenshot: no scrollbar (it still scrolls).
    const onLoad = () => {
        const doc = frame.current?.contentDocument;
        if (doc?.head && !doc.getElementById('ma-page-preview')) {
            const style = doc.createElement('style');
            style.id = 'ma-page-preview';
            style.textContent = 'html { scrollbar-width: none; } html::-webkit-scrollbar { display: none; }';
            doc.head.appendChild(style);
        }
        send();
    };

    // The page listens once it is displayed, which can come after the iframe's load event.
    useEffect(() => {
        const onReady = (event: MessageEvent) => {
            if (event.source === frame.current?.contentWindow && event.data?.type === ORGANIZER_PREVIEW_READY) {
                send();
            }
        };
        window.addEventListener('message', onReady);
        return () => window.removeEventListener('message', onReady);
    }, []);

    return (
        <iframe
            ref={frame}
            src={src}
            title={t`Live preview of your page`}
            className={className}
            style={style}
            onLoad={onLoad}
        />
    );
};

export type PreviewDevice = 'desktop' | 'mobile';

interface PreviewPanelProps {
    src: string;
    url: string;
    draft: OrganizerPreviewDraft;
}

export const PreviewPanel = ({src, url, draft}: PreviewPanelProps) => {
    const [device, setDevice] = useState<PreviewDevice>('desktop');
    const {ref, width, height} = useElementSize();

    const desktopScale = width / DESKTOP_WIDTH;
    const phoneScale = Math.min(1, (height - 32) / PHONE.height, (width - 32) / PHONE.width);

    return (
        <div className={classes.preview}>
            <div className={classes.browserBar}>
                <img src="/interface/admin/ma-page/dots.svg" alt=""/>
                <div className={classes.address}>
                    <img src="/interface/admin/ma-page/lock.svg" alt=""/>
                    <span>{url}</span>
                </div>
                <div className={classes.devices} role="group" aria-label={t`Preview`}>
                    <button type="button" className={classes.device} aria-pressed={device === 'desktop'}
                            aria-label={t({message: 'Desktop', context: 'preview device'})}
                            title={t({message: 'Desktop', context: 'preview device'})}
                            onClick={() => setDevice('desktop')}>
                        <IconDeviceDesktop size={15} stroke={2}/>
                    </button>
                    <button type="button" className={classes.device} aria-pressed={device === 'mobile'}
                            aria-label={t({message: 'Mobile', context: 'preview device'})}
                            title={t({message: 'Mobile', context: 'preview device'})}
                            onClick={() => setDevice('mobile')}>
                        <IconDeviceMobile size={15} stroke={2}/>
                    </button>
                </div>
            </div>

            <div ref={ref} className={classes.viewport} data-device={device}>
                {width > 0 && device === 'desktop' && (
                    <PreviewFrame
                        src={src}
                        draft={draft}
                        className={classes.frame}
                        style={{
                            width: DESKTOP_WIDTH,
                            height: height / desktopScale,
                            transform: `scale(${desktopScale})`,
                        }}
                    />
                )}
                {width > 0 && device === 'mobile' && (
                    <div className={classes.phone}
                         style={{width: PHONE.width * phoneScale, height: PHONE.height * phoneScale}}>
                        <PreviewFrame
                            src={src}
                            draft={draft}
                            className={classes.frame}
                            style={{
                                width: PHONE.width,
                                height: PHONE.height,
                                transform: `scale(${phoneScale})`,
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

interface PreviewModalProps {
    opened: boolean;
    onClose: () => void;
    src: string;
    draft: OrganizerPreviewDraft;
}

// Mobile: the « Aperçu » button opens the page full screen.
export const PreviewModal = ({opened, onClose, src, draft}: PreviewModalProps) => (
    <Modal
        opened={opened}
        onClose={onClose}
        fullScreen
        radius={0}
        transitionProps={{transition: 'slide-up', duration: 200}}
        title={t`Preview`}
        closeButtonProps={{'aria-label': t`Close`}}
        className={classes.fullscreen}
    >
        {opened && <PreviewFrame src={src} draft={draft} className={classes.fullscreenFrame}/>}
    </Modal>
);
