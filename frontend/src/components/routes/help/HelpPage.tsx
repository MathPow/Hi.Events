import {ReactNode} from "react";
import {Helmet} from "react-helmet-async";
import {PublicBarLink, PublicPageBar} from "../../common/PublicPageBar";
import {PublicPageFooter} from "../../common/PublicPageFooter";
import shell from "../../layouts/OrganizerHomepage/OrganizerHomepage.module.scss";
import directory from "../events-directory/EventsDirectory.module.scss";
import classes from "./Help.module.scss";

// The frame of the help pages: the public pages' cream, bar and footer (like /events).
export const HelpPage = ({title, description, children}: { title: string, description: string, children: ReactNode }) => (
    <main className={`${shell.page} ${directory.page} ${classes.page}`}>
        <Helmet>
            <title>{title}</title>
            <meta name="description" content={description}/>
        </Helmet>
        <style>
            {/* eslint-disable-next-line lingui/no-unlocalized-strings */}
            {`
                body, .ssr-loader {
                    background-color: var(--dehors-creme) !important;
                }
            `}
        </style>

        <div className={`${shell.content} ${directory.content}`}>
            <div className={shell.bar}>
                {/* eslint-disable-next-line lingui/no-unlocalized-strings */}
                <PublicPageBar left={<PublicBarLink to={'/'}>Billetterie Dehors</PublicBarLink>}/>
            </div>
            {children}
            <PublicPageFooter/>
        </div>
    </main>
);
