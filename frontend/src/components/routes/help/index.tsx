import {t} from "@lingui/macro";
import {useLingui} from "@lingui/react";
import {FaqAccordion} from "../../common/FaqAccordion";
import {helpContent, SUPPORT_EMAIL} from "./content";
import {RichParagraphs} from "./RichText.tsx";
import {AskAssistant} from "./AskAssistant.tsx";
import {GuideCards} from "./GuideCards.tsx";
import {HelpPage} from "./HelpPage.tsx";
import shell from "../../layouts/OrganizerHomepage/OrganizerHomepage.module.scss";
import directory from "../events-directory/EventsDirectory.module.scss";
import classes from "./Help.module.scss";

/**
 * The help center (/help), public: the assistant first, then the step-by-step guides (laid out
 * like the DEHORS blog, /help/<slug>) and the frequent questions. The back office's « Help
 * center » leads here.
 */
const HelpCenter = () => {
    const {i18n} = useLingui();
    const {guides, questions} = helpContent(i18n.locale);

    return (
        <HelpPage title={t`Help center · Billetterie Dehors`}
                  description={t`Step-by-step guides, answers to frequent questions and an assistant for the rest.`}>
            <header className={directory.hero}>
                <img src={'/landing/stickers/autocollant-sac-a-dos.svg'} alt="" aria-hidden
                     className={`${directory.stickerCamera} ${classes.stickerBackpack}`}/>
                <p className={directory.kicker}>{t`How can we help?`}</p>
                <h1 className={directory.title}>
                    <span className={directory.titleText}>
                        {t`Help center`}
                        <img src={'/landing/stickers/autocollant-feu-de-camp.svg'} alt="" aria-hidden
                             className={directory.stickerFlag}/>
                    </span>
                </h1>
                <p className={directory.line}>
                    {t`Step-by-step guides, answers to frequent questions and an assistant for the rest.`}
                </p>
            </header>

            <AskAssistant/>

            <section className={`${shell.card} ${shell.section}`} data-rough aria-labelledby="help-guides">
                <h2 id="help-guides" className={shell.sectionTitle}>{t`Guides`}</h2>
                <GuideCards guides={guides} featured/>
            </section>

            <section className={`${shell.card} ${shell.section}`} data-rough aria-labelledby="help-questions">
                <h2 id="help-questions" className={shell.sectionTitle}>{t`Frequently asked questions`}</h2>
                <FaqAccordion faqs={questions.map(({question, answer}) => ({
                    question,
                    answer: <div className={classes.answer}><RichParagraphs text={answer}/></div>,
                }))}/>
            </section>

            <p className={classes.contact}>
                {t`Still stuck? Write to us:`} <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </p>
        </HelpPage>
    );
};

export default HelpCenter;
