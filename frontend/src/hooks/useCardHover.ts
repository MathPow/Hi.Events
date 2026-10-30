import {PointerEvent, useCallback, useEffect, useRef} from "react";

// D'apres la carte d'evenement du site DEHORS (dehors-shop-new, CarteEvenement.vue), sans le
// glissement de la carte vers le curseur: seule la photo bouge.
// La photo zoome dans son cadre et glisse au plus de PAN % de sa taille, sous le debord du zoom.
const PHOTO_ZOOM = 1.08;
const PAN = 3.5;
// Part du chemin restant parcourue a chaque image: plus c'est bas, plus c'est mou.
const EASING = 0.15;

const REST = {px: 0, py: 0, zoom: 1};
type Pose = typeof REST;

/**
 * Au survol de la souris, la photo de la carte zoome et se decale a l'oppose du curseur,
 * pour montrer le cote vers lequel il pointe; la carte, elle, reste en place. Tout revient
 * en douceur quand la souris sort. Souris seulement, et coupe sous « mouvement reduit ».
 * La photo doit etre dans un cadre qui la coupe (overflow: hidden).
 */
export const useCardHover = <C extends HTMLElement, P extends HTMLElement>() => {
    const card = useRef<C>(null);
    const photo = useRef<P>(null);
    const current = useRef<Pose>({...REST});
    const target = useRef<Pose>({...REST});
    const frame = useRef<number | null>(null);

    const animate = useCallback(() => {
        frame.current = null;
        const pose = current.current;
        const aim = target.current;
        (Object.keys(pose) as (keyof Pose)[]).forEach((key) => {
            pose[key] += (aim[key] - pose[key]) * EASING;
        });

        const arrived = Math.abs(aim.px - pose.px) < 0.01 && Math.abs(aim.py - pose.py) < 0.01
            && Math.abs(aim.zoom - pose.zoom) < 0.0005;
        if (arrived) {
            Object.assign(pose, aim);
        }

        if (photo.current) {
            photo.current.style.transform = pose.px === 0 && pose.py === 0 && pose.zoom === 1
                ? ''
                : `translate(${pose.px.toFixed(3)}%, ${pose.py.toFixed(3)}%) scale(${pose.zoom.toFixed(4)})`;
        }
        if (!arrived) {
            frame.current = requestAnimationFrame(animate);
        }
    }, []);

    const restart = useCallback(() => {
        frame.current ??= requestAnimationFrame(animate);
    }, [animate]);

    const onPointerMove = useCallback((event: PointerEvent<C>) => {
        if (event.pointerType !== 'mouse' || !card.current
            || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        // Position du curseur sur la carte, de -0,5 a 0,5: la photo glisse a l'oppose.
        const box = card.current.getBoundingClientRect();
        const nx = Math.min(Math.max((event.clientX - box.left) / box.width - 0.5, -0.5), 0.5);
        const ny = Math.min(Math.max((event.clientY - box.top) / box.height - 0.5, -0.5), 0.5);
        target.current = {px: -nx * 2 * PAN, py: -ny * 2 * PAN, zoom: PHOTO_ZOOM};
        restart();
    }, [restart]);

    const onPointerLeave = useCallback(() => {
        target.current = {...REST};
        restart();
    }, [restart]);

    useEffect(() => () => {
        if (frame.current !== null) {
            cancelAnimationFrame(frame.current);
        }
    }, []);

    return {card, photo, handlers: {onPointerMove, onPointerLeave, onPointerCancel: onPointerLeave}};
};
