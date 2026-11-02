import {FC, useEffect, useRef, useState} from 'react';

interface ConfettiAnimationProps {
    duration?: number;
}

// Paper confetti in the DEHORS colours (dehors-app.scss): orange, light orange, sand, terracotta and brown.
// eslint-disable-next-line lingui/no-unlocalized-strings
const COLOURS = ['#fa7853', '#ffaa8d', '#e3ad92', '#c47762', '#352924'];

interface Piece {
    x: number;
    y: number;
    width: number;
    height: number;
    colour: string;
    speedX: number;
    speedY: number;
    angle: number;
    spin: number;
    flip: number;
    flipSpeed: number;
}

const newPiece = (width: number, y: number): Piece => ({
    x: Math.random() * width,
    y,
    width: 6 + Math.random() * 6,
    height: 10 + Math.random() * 8,
    colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
    speedX: (Math.random() - 0.5) * 2,
    speedY: 3 + Math.random() * 3,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.2,
    flip: Math.random() * Math.PI * 2,
    flipSpeed: 0.08 + Math.random() * 0.1,
});

/**
 * A short fall of paper confetti over the page, once the event is created. Nothing when the system asks
 * for less motion.
 */
const ConfettiAnimation: FC<ConfettiAnimationProps> = ({duration = 4000}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isActive, setIsActive] = useState(true);

    useEffect(() => {
        // eslint-disable-next-line lingui/no-unlocalized-strings
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setIsActive(false);
            return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const resize = () => {
            const ratio = window.devicePixelRatio || 1;
            canvas.width = window.innerWidth * ratio;
            canvas.height = window.innerHeight * ratio;
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        };
        resize();
        window.addEventListener('resize', resize);

        // A first burst spread above the screen, then a few more while the duration lasts; as many
        // as fit the width (120 on a computer, about 50 on a phone)
        const density = Math.min(1, window.innerWidth / 1440);
        const pieces: Piece[] = Array.from({length: Math.max(40, Math.round(120 * density))},
            () => newPiece(window.innerWidth, -20 - Math.random() * window.innerHeight * 0.5));
        const start = performance.now();
        let frame = 0;

        const animate = (time: number) => {
            const elapsed = time - start;
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

            if (elapsed < duration && pieces.length < 200 && Math.random() < density) {
                pieces.push(newPiece(window.innerWidth, -20));
            }

            for (let i = pieces.length - 1; i >= 0; i--) {
                const piece = pieces[i];
                piece.x += piece.speedX + Math.sin(piece.flip) * 0.6;
                piece.y += piece.speedY;
                piece.speedY = Math.min(piece.speedY + 0.04, 8);
                piece.angle += piece.spin;
                piece.flip += piece.flipSpeed;

                if (piece.y > window.innerHeight + 20) {
                    pieces.splice(i, 1);
                    continue;
                }

                // The paper turning over: its height follows the flip
                ctx.save();
                ctx.translate(piece.x, piece.y);
                ctx.rotate(piece.angle);
                ctx.scale(1, Math.cos(piece.flip));
                ctx.fillStyle = piece.colour;
                ctx.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
                ctx.restore();
            }

            if (pieces.length > 0) {
                frame = requestAnimationFrame(animate);
            } else {
                setIsActive(false);
            }
        };

        frame = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(frame);
        };
    }, [duration]);

    if (!isActive) return null;

    return (
        <canvas
            ref={canvasRef}
            aria-hidden
            style={{
                position: 'fixed',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 99099,
            }}
        />
    );
};

export default ConfettiAnimation;
