import {t} from "@lingui/macro";
import {useLingui} from "@lingui/react";
import {Link, useParams} from "react-router";
import {PublicIcon} from "../../common/PublicIcon";
import {helpContent, SUPPORT_EMAIL} from "./content";
import {HelpBlock} from "./content/types.ts";
import {RichText} from "./RichText.tsx";
import {AskAssistant} from "./AskAssistant.tsx";
import {GuideCards} from "./GuideCards.tsx";
import {HelpPage} from "./HelpPage.tsx";
import shell from "../../layouts/OrganizerHomepage/OrganizerHomepage.module.scss";
import classes from "./Help.module.scss";

const Block = ({block}: { block: HelpBlock }) => {
    if ('h2' in block) {
        return <h2>{block.h2}</h2>;
    }
    if ('ul' in block || 'ol' in block) {
        const items = 'ul' in block ? block.ul : block.ol;
        const List = 'ul' in block ? 'ul' : 'ol';
        return <List>{items.map((item, index) => <li key={index}><RichText text={item}/></li>)}</List>;
    }
    if ('tip' in block) {
        return <p className={classes.tip}><RichText text={block.tip}/></p>;
    }
    return <p><RichText text={block.p}/></p>;
};

const BackLink = () => (
    <Link to={'/help'} className={classes.back}>
        <PublicIcon name={'retour'} size={14}/>
        {t`Help center`}
    </Link>
);

/** A guide of the help center (/help/<slug>), laid out like an article of the DEHORS blog. */
const HelpGuide = () => {
    const {slug} = useParams();
    const {i18n} = useLingui();
    const {guides} = helpContent(i18n.locale);
    const guide = guides.find((candidate) => candidate.slug === slug);

    if (!guide) {
        return (
            <HelpPage title={t`Guide not found · Billetterie Dehors`} description={t`This guide doesn't exist or has moved.`}>
                <article className={classes.article}>
                    <BackLink/>
                    <h1 className={classes.articleTitle}>{t`Guide not found`}</h1>
                    <p className={classes.lead}>{t`This guide doesn't exist or has moved.`}</p>
                </article>
                <section className={`${shell.card} ${shell.section}`} data-rough aria-label={t`Guides`}>
                    <GuideCards guides={guides}/>
                </section>
            </HelpPage>
        );
    }

    // At noon, for the day to be the same on the server and in the browser.
    const date = new Intl.DateTimeFormat(i18n.locale, {dateStyle: 'long'}).format(new Date(`${guide.updated}T12:00:00`));
    const minutes = guide.minutes;

    return (
        // eslint-disable-next-line lingui/no-unlocalized-strings
        <HelpPage title={`${guide.title} · Billetterie Dehors`} description={guide.lead}>
            <article className={classes.article}>
                <BackLink/>
                <p className={classes.category}>{guide.category}</p>
                <h1 className={classes.articleTitle}>{guide.title}</h1>
                <p className={classes.lead}>{guide.lead}</p>
                <p className={classes.meta}>{t`Updated ${date}`} · {t`${minutes} min read`}</p>
                <div className={classes.body}>
                    {guide.blocks.map((block, index) => <Block key={index} block={block}/>)}
                    <p>
                        {t`Still stuck? Write to us:`} <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
                    </p>
                </div>
            </article>

            <AskAssistant title={t`A question about this guide?`}/>

            <section className={`${shell.card} ${shell.section}`} data-rough aria-labelledby="help-other-guides">
                <h2 id="help-other-guides" className={shell.sectionTitle}>{t`Other guides`}</h2>
                {/* The next three, one row. */}
                <GuideCards guides={[...guides, ...guides]
                    .slice(guides.indexOf(guide) + 1, guides.indexOf(guide) + 4)}/>
            </section>
        </HelpPage>
    );
};

export default HelpGuide;
