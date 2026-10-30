import {t} from "@lingui/macro";
import {UnstyledButton} from "@mantine/core";
import {ReactNode} from "react";

import {PublicIcon} from "../PublicIcon";
import {Carousel} from "../../../hooks/useCarousel.ts";
import classes from './Carousel.module.scss';

// Les fleches, dans l'en-tete de la section; cachees sur telephone, ou l'on glisse.
export const CarouselNav = ({carousel}: { carousel: Carousel }) => {
    const {edges, page} = carousel;

    if (edges.atStart && edges.atEnd) {
        return null;
    }

    return (
        <div className={classes.nav}>
            <UnstyledButton className={classes.navButton} data-rough="button" disabled={edges.atStart}
                            aria-label={t({message: 'Previous', context: 'carousel'})} onClick={() => page(-1)}>
                <PublicIcon name={'retour'} size={20}/>
            </UnstyledButton>
            <UnstyledButton className={classes.navButton} data-rough="button" disabled={edges.atEnd}
                            aria-label={t({message: 'Next', context: 'carousel'})} onClick={() => page(1)}>
                <PublicIcon name={'fleche'} size={20}/>
            </UnstyledButton>
        </div>
    );
};

// La liste: des <li>, chacun une carte.
export const CarouselList = ({carousel, children}: { carousel: Carousel, children: ReactNode }) => (
    <ul ref={carousel.list} className={classes.list}>{children}</ul>
);
