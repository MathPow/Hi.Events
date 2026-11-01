import {t} from "@lingui/macro";
import {Link} from "react-router";
import {PublicIcon} from "../../common/PublicIcon";
import {HelpGuide} from "./content/types.ts";
import classes from "./Help.module.scss";

// The guides as cards, like the articles of the DEHORS blog: theme, title, summary, reading time.
// `featured`: the first one twice as wide.
export const GuideCards = ({guides, featured}: { guides: HelpGuide[], featured?: boolean }) => (
    <ul className={featured ? `${classes.guides} ${classes.guidesFeatured}` : classes.guides}>
        {guides.map((guide) => {
            const minutes = guide.minutes;
            return (
                <li key={guide.slug}>
                    <Link to={`/help/${guide.slug}`} className={classes.guideCard} data-rough>
                        <span className={classes.category}>{guide.category}</span>
                        <span className={classes.guideTitle}>{guide.title}</span>
                        <span className={classes.guideLead}>{guide.lead}</span>
                        <span className={classes.guideMeta}>
                            {t`${minutes} min read`}
                            <PublicIcon name={'fleche'} size={18}/>
                        </span>
                    </Link>
                </li>
            );
        })}
    </ul>
);
