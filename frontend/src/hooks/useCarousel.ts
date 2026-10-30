import {useEffect, useRef, useState} from "react";

// Trois cartes tiennent dans une section sur grand ecran: au-dela, le carrousel defile.
const CARDS_IN_VIEW = 3;

/**
 * Un carrousel de cartes (le repertoire, les billets a venir de Mes billets), affiche par
 * CarouselNav et CarouselList: la liste defile a l'horizontale, aimantee au debut d'une carte,
 * et les fleches de la section la font defiler d'une page. Elles disparaissent quand tout
 * tient. `count` sert a deviner, avant la mesure, s'il y a de quoi defiler.
 */
export const useCarousel = (count: number) => {
    const list = useRef<HTMLUListElement>(null);
    const [edges, setEdges] = useState({atStart: true, atEnd: count <= CARDS_IN_VIEW});

    useEffect(() => {
        const element = list.current;
        if (!element) {
            return;
        }
        const update = () => setEdges({
            atStart: element.scrollLeft <= 1,
            atEnd: element.scrollLeft + element.clientWidth >= element.scrollWidth - 1,
        });
        update();
        element.addEventListener('scroll', update, {passive: true});
        const observer = new ResizeObserver(update);
        observer.observe(element);

        return () => {
            element.removeEventListener('scroll', update);
            observer.disconnect();
        };
    }, [count]);

    // Une page: la largeur visible, que l'aimantation ramene au debut d'une carte.
    const page = (direction: 1 | -1) => {
        const element = list.current;
        if (!element) {
            return;
        }
        const style = getComputedStyle(element);
        const visible = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        // eslint-disable-next-line lingui/no-unlocalized-strings
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        element.scrollBy({left: direction * visible, behavior: reduceMotion ? 'auto' : 'smooth'});
    };

    return {list, edges, page};
};

export type Carousel = ReturnType<typeof useCarousel>;
