import {ReactNode} from "react";
import classNames from "classnames";
import classes from "./StatusTag.module.scss";

export type StatusTone = 'ok' | 'waiting' | 'neutral' | 'problem';

interface StatusTagProps {
    tone?: StatusTone;
    children: ReactNode;
    className?: string;
    title?: string;
}

/**
 * A status pill of the organizer pages: green when done or on sale, yellow while waiting (payment,
 * almost full), neutral for drafts and ended or cancelled things, red for failures and refunds.
 */
export const StatusTag = ({tone = 'neutral', children, className, title}: StatusTagProps) => (
    <span className={classNames(classes.tag, className)} data-tone={tone} title={title}>
        {children}
    </span>
);
