import {Accordion} from "@mantine/core";
import {ReactNode} from "react";
import classes from "../../layouts/OrganizerHomepage/OrganizerHomepage.module.scss";

// La pastille de la FAQ du site DEHORS: le plus et le moins se croisent a l'ouverture.
const FaqPastille = () => (
    <span className={classes.faqPastille} aria-hidden="true">
        <img className={classes.faqPlus} src={'/interface/faq/plus.svg'} width={16} height={16} alt={''}/>
        <img className={classes.faqMoins} src={'/interface/faq/moins.svg'} width={16} height={16} alt={''}/>
    </span>
);

export interface FaqEntry {
    question: string;
    answer: ReactNode;
}

// Les questions frequentes des pages publiques (page d'un organisateur, centre d'aide), en
// tuiles sable comme la FAQ du site DEHORS. Plusieurs peuvent rester ouvertes.
export const FaqAccordion = ({faqs}: { faqs: FaqEntry[] }) => (
    <Accordion
        multiple
        chevronPosition="right"
        chevron={<FaqPastille/>}
        chevronSize={40}
        disableChevronRotation
        transitionDuration={300}
        classNames={{
            root: classes.faq,
            item: classes.faqItem,
            control: classes.faqControl,
            label: classes.faqQuestion,
            chevron: classes.faqChevron,
            content: classes.faqAnswer,
        }}
    >
        {faqs.map((faq, index) => (
            <Accordion.Item key={index} value={String(index)} data-rough>
                <Accordion.Control>{faq.question}</Accordion.Control>
                <Accordion.Panel>{faq.answer}</Accordion.Panel>
            </Accordion.Item>
        ))}
    </Accordion>
);
