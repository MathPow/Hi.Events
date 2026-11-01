import {Fragment, ReactNode} from "react";
import {JSONContent} from "@tiptap/core";
import {DocumentBlock} from "../../../api/organizerDocument.client.ts";
import {autoFieldLabel} from "./blocks.ts";
import classes from "./DocumentContent.module.scss";

interface DocumentContentProps {
    blocks: DocumentBlock[];
    // Les champs automatiques connus (nom du participant...); les autres restent en pastille.
    autoValues?: Partial<Record<string, string>>;
    // Ce qu'il faut a la place d'un bloc qui se remplit (champ, case, signature); rien = le bloc par defaut.
    renderInput?: (block: DocumentBlock) => ReactNode | undefined;
}

/**
 * Un document de l'organisateur en lecture: le texte des blocs (gras, italique,
 * champs automatiques), les clauses numerotees, et a la place des champs, des
 * cases et des signatures ce que renderInput fournit (les champs de la caisse).
 */
export const DocumentContent = ({blocks, autoValues, renderInput}: DocumentContentProps) => {
    let clauseNumber = 0;

    const inline = (paragraph: JSONContent, key: string | number) => (
        <Fragment key={key}>
            {(paragraph.content ?? []).map((node, index) => {
                if (node.type === 'hardBreak') {
                    return <br key={index}/>;
                }
                if (node.type === 'field') {
                    const fieldKey = String(node.attrs?.key ?? '');
                    const value = autoValues?.[fieldKey];
                    return value
                        ? <strong key={index}>{value}</strong>
                        : <span key={index} className={classes.chip}>{autoFieldLabel(fieldKey)}</span>;
                }
                let text: ReactNode = node.text ?? '';
                (node.marks ?? []).forEach(mark => {
                    text = mark.type === 'bold' ? <strong>{text}</strong> : mark.type === 'italic' ? <em>{text}</em> : text;
                });
                return <Fragment key={index}>{text}</Fragment>;
            })}
        </Fragment>
    );

    const paragraphs = (doc: JSONContent | undefined) => (doc?.content ?? []).map((node, index) => {
        if (node.type === 'bulletList') {
            return (
                <ul key={index}>
                    {(node.content ?? []).map((item, itemIndex) => (
                        <li key={itemIndex}>
                            {(item.content ?? []).map((paragraph, paragraphIndex) => inline(paragraph, paragraphIndex))}
                        </li>
                    ))}
                </ul>
            );
        }
        return <p key={index}>{inline(node, index)}</p>;
    });

    return (
        <div className={classes.document}>
            {blocks.map(block => {
                const input = renderInput?.(block);

                switch (block.type) {
                    case 'title':
                        return <h3 key={block.id} className={classes.title}>{paragraphs(block.content)}</h3>;
                    case 'paragraph':
                    case 'list':
                        return <div key={block.id} className={classes.text}>{paragraphs(block.content)}</div>;
                    case 'clause':
                        clauseNumber++;
                        return (
                            <div key={block.id} className={classes.clause}>
                                <span className={classes.clauseNumber}>{clauseNumber}.</span>
                                <div>{paragraphs(block.content)}</div>
                            </div>
                        );
                    case 'separator':
                        return <hr key={block.id} className={classes.separator}/>;
                    default:
                        return input === undefined ? null : <div key={block.id} className={classes.input}>{input}</div>;
                }
            })}
        </div>
    );
};

/** Le texte d'une case a cocher, pour l'etiquette d'un champ. */
export const RichInline = ({content, autoValues}: { content?: JSONContent, autoValues?: Partial<Record<string, string>> }) => (
    <DocumentContent blocks={[{id: 'inline', type: 'paragraph', content}]} autoValues={autoValues}/>
);
