export const downloadBinary = (binary: Blob, fileName: string) => {
    const url = window?.URL.createObjectURL(binary);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window?.URL.revokeObjectURL(url);
}

export const downloadFile = (fileUrl: string, filename: string) => {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = filename;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const QR_SIZE = 1024;
const QR_MARGIN = 96;

/** A ticket's QR code as a picture to keep: the SVG drawn by react-qr-code, dark brown on white
 * with its quiet margin, as a PNG. */
export const qrCodePng = (svg: SVGSVGElement): Promise<Blob | null> => new Promise((resolve) => {
    const markup = new XMLSerializer().serializeToString(svg).replace(/currentColor/g, '#352924');
    const source = URL.createObjectURL(new Blob([markup], {type: 'image/svg+xml'}));
    const image = new Image();

    image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = QR_SIZE;
        canvas.height = QR_SIZE;
        const context = canvas.getContext('2d');
        URL.revokeObjectURL(source);
        if (!context) {
            resolve(null);
            return;
        }
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, QR_SIZE, QR_SIZE);
        context.drawImage(image, QR_MARGIN, QR_MARGIN, QR_SIZE - 2 * QR_MARGIN, QR_SIZE - 2 * QR_MARGIN);
        canvas.toBlob(resolve, 'image/png');
    };
    image.onerror = () => {
        URL.revokeObjectURL(source);
        resolve(null);
    };
    image.src = source;
});

/** The PNG downloaded. The blob link is revoked a moment later: right after the click, Safari on
 * iPhone could cancel the download. */
export const downloadQrCode = async (svg: SVGSVGElement, fileName: string) => {
    const png = await qrCodePng(svg);
    if (!png) {
        return;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(png);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
};

/**
 * iPhone and iPad: Safari keeps downloads in Files, but its share sheet has « Save Image », which
 * puts the picture in Photos. (On Android, a download already lands in the gallery.)
 */
export const canSaveImageToPhotos = (): boolean => {
    if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') {
        return false;
    }
    const userAgent = navigator.userAgent;
    const isAppleMobile = /iPhone|iPad|iPod/.test(userAgent)
        || (/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1);

    return isAppleMobile && navigator.canShare({files: [new File([''], 'qr.png', {type: 'image/png'})]});
};

/**
 * Opens the share sheet with the picture. Safari opens it only right in the tap: the file is made
 * beforehand. False when the sheet could not open (the caller downloads the picture instead).
 */
export const shareImage = async (file: File): Promise<boolean> => {
    try {
        await navigator.share({files: [file]});
        return true;
    } catch (error) {
        // Closed without saving: nothing more to do.
        return (error as DOMException)?.name === 'AbortError';
    }
};
