import {Fragment, ReactNode} from "react";

/**
 * The little Markdown the assistant writes: paragraphs, headings, bullet and
 * numbered lists, simple tables, **bold**, *italic*, `code`, [links](…) and bare URLs.
 * Rendered as React elements, never as HTML, so nothing in an answer can run.
 */

type LinkRenderer = (href: string, children: ReactNode, key: string) => ReactNode;

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|https?:\/\/[^\s<]*[^\s<.,;:!?)])/g;

function inline(text: string, link: LinkRenderer, keyPrefix: string): ReactNode[] {
    return text.split(INLINE).filter(Boolean).map((part, i) => {
        const key = `${keyPrefix}-${i}`;
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
            return <strong key={key}>{inline(part.slice(2, -2), link, key)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
            return <code key={key}>{part.slice(1, -1)}</code>;
        }
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        if (linkMatch) {
            return link(linkMatch[2], inline(linkMatch[1], link, key), key);
        }
        if (/^https?:\/\//.test(part)) {
            return link(part, part, key);
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
            return <em key={key}>{part.slice(1, -1)}</em>;
        }
        return <Fragment key={key}>{part}</Fragment>;
    });
}

const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isTableRule = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());

export const Markdown = ({text, link}: { text: string; link: LinkRenderer }) => {
    const lines = text.replace(/\r/g, "").split("\n");
    const blocks: ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const key = `b${i}`;

        if (!line.trim()) {
            i++;
            continue;
        }

        const heading = line.match(/^#{1,6}\s+(.*)$/);
        if (heading) {
            blocks.push(<p key={key} data-heading><strong>{inline(heading[1], link, key)}</strong></p>);
            i++;
            continue;
        }

        if (isTableRow(line) && i + 1 < lines.length && isTableRule(lines[i + 1])) {
            const head = cells(line);
            const rows: string[][] = [];
            i += 2;
            while (i < lines.length && isTableRow(lines[i])) {
                rows.push(cells(lines[i]));
                i++;
            }
            blocks.push(
                <div key={key} data-table>
                    <table>
                        <thead>
                        <tr>{head.map((cell, c) => <th key={c}>{inline(cell, link, `${key}h${c}`)}</th>)}</tr>
                        </thead>
                        <tbody>
                        {rows.map((row, r) => (
                            <tr key={r}>{row.map((cell, c) => <td key={c}>{inline(cell, link, `${key}r${r}c${c}`)}</td>)}</tr>
                        ))}
                        </tbody>
                    </table>
                </div>,
            );
            continue;
        }

        const bullet = /^\s*[-*•]\s+/;
        const numbered = /^\s*\d+[.)]\s+/;
        if (bullet.test(line) || numbered.test(line)) {
            const pattern = bullet.test(line) ? bullet : numbered;
            const items: string[] = [];
            while (i < lines.length && pattern.test(lines[i])) {
                items.push(lines[i].replace(pattern, ""));
                i++;
            }
            const List = pattern === bullet ? "ul" : "ol";
            blocks.push(
                <List key={key}>
                    {items.map((item, n) => <li key={n}>{inline(item, link, `${key}i${n}`)}</li>)}
                </List>,
            );
            continue;
        }

        const paragraph: string[] = [];
        while (i < lines.length && lines[i].trim() && !/^#{1,6}\s/.test(lines[i])
        && !bullet.test(lines[i]) && !numbered.test(lines[i]) && !isTableRow(lines[i])) {
            paragraph.push(lines[i]);
            i++;
        }
        if (!paragraph.length) {
            paragraph.push(lines[i]);
            i++;
        }
        blocks.push(
            <p key={key}>
                {paragraph.map((part, n) => (
                    <Fragment key={n}>{n > 0 && <br/>}{inline(part, link, `${key}p${n}`)}</Fragment>
                ))}
            </p>,
        );
    }

    return <>{blocks}</>;
};
