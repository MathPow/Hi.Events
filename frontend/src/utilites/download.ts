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

/**
 * A ticket's QR code as a picture to keep: the SVG drawn by react-qr-code, dark brown on white
 * with its quiet margin, as a PNG. The blob link is revoked a moment later: right after the
 * click, Safari on iPhone could cancel the download.
 */
export const downloadQrCode = (svg: SVGSVGElement, fileName: string) => {
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
            return;
        }
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, QR_SIZE, QR_SIZE);
        context.drawImage(image, QR_MARGIN, QR_MARGIN, QR_SIZE - 2 * QR_MARGIN, QR_SIZE - 2 * QR_MARGIN);

        canvas.toBlob((png) => {
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
        }, 'image/png');
    };
    image.src = source;
};
