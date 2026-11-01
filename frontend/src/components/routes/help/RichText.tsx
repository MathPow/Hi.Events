import {Fragment, ReactNode} from "react";
import {Link} from "react-router";

// **bold** and [label](href), nothing else: the help texts never carry HTML.
const TOKEN = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;

export const RichText = ({text}: { text: string }) => {
    const parts: ReactNode[] = [];
    let last = 0;
    for (const match of text.matchAll(TOKEN)) {
        const index = match.index ?? 0;
        parts.push(text.slice(last, index));
        const [, bold, label, href] = match;
        if (bold !== undefined) {
            parts.push(<strong key={index}>{bold}</strong>);
        } else if (href.startsWith('/')) {
            parts.push(<Link key={index} to={href}>{label}</Link>);
        } else {
            parts.push(<a key={index} href={href} target="_blank" rel="noreferrer">{label}</a>);
        }
        last = index + match[0].length;
    }
    parts.push(text.slice(last));

    return <>{parts.map((part, index) => <Fragment key={index}>{part}</Fragment>)}</>;
};

// An answer of several paragraphs, separated by a blank line.
export const RichParagraphs = ({text}: { text: string }) => (
    <>
        {text.split(/\n{2,}/).map((paragraph, index) => <p key={index}><RichText text={paragraph}/></p>)}
    </>
);
