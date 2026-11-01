import {IconPlus, IconUsers} from "@tabler/icons-react";
import classNames from "classnames";
import {DocumentTemplateKey} from "../../../../api/organizerDocument.client.ts";
import classes from "./DocumentThumbnail.module.scss";

// A signature, drawn by hand.
const Scribble = () => (
    <svg className={classes.scribble} viewBox="0 0 60 16" aria-hidden>
        <path d="M2 12C7 3 11 2 13 9s7 5 11-3 8-5 10 3 6 6 10 0 7-5 14-4"/>
    </svg>
);

const Line = ({width}: { width?: number }) => (
    <span className={classes.line} style={width ? {width: `${width}%`} : undefined}/>
);

/**
 * The little sheet of a document or of a starting template: each template its own color and its
 * own page (two signatures for the parental consent, boxes to tick for the waiver, fields for the
 * medical form, a photo for the photo consent, an empty page for the blank one). A document made
 * from scratch gets the plain sheet.
 */
export const DocumentThumbnail = ({template, className}: {
    template: DocumentTemplateKey | null,
    className?: string,
}) => {
    const kind = template ?? 'custom';

    return (
        <span className={classNames(classes.frame, className)} data-kind={kind} aria-hidden>
            <span className={classes.sheet}>
                {kind === 'parental_consent' && (
                    <>
                        <span className={classes.badge}><IconUsers size={12} stroke={2.25}/></span>
                        <span className={classes.title}/>
                        <Line/><Line width={84}/><Line width={64}/>
                        <span className={classes.signatures}>
                            <span className={classes.signature}><Scribble/><Line/></span>
                            <span className={classes.signature}><Scribble/><Line/></span>
                        </span>
                    </>
                )}

                {kind === 'liability_waiver' && (
                    <>
                        <span className={classes.title}/>
                        <Line/><Line width={92}/><Line width={70}/>
                        <span className={classes.check}><span className={classes.box} data-checked/><Line width={72}/></span>
                        <span className={classes.check}><span className={classes.box} data-checked/><Line width={56}/></span>
                        <span className={`${classes.signature} ${classes.bottom}`}><Scribble/><Line width={60}/></span>
                    </>
                )}

                {kind === 'medical_form' && (
                    <>
                        <span className={classes.cross}/>
                        <span className={classes.title}/>
                        <span className={classes.field}><Line width={40}/><span className={classes.input}/></span>
                        <span className={classes.field}><Line width={56}/><span className={classes.input}/></span>
                        <span className={classes.check}>
                            <span className={classes.box} data-checked/><Line width={18}/>
                            <span className={classes.box}/><Line width={18}/>
                        </span>

                    </>
                )}

                {kind === 'photo_consent' && (
                    <>
                        <span className={classes.title}/>
                        <span className={classes.photo}>
                            <svg viewBox="0 0 60 34" preserveAspectRatio="xMidYMax slice" aria-hidden>
                                <circle cx="45" cy="16" r="4.5" className={classes.sun}/>
                                <path d="M0 34 17 13l10 12 8-8 25 17Z" className={classes.mountain}/>
                            </svg>
                        </span>
                        <span className={classes.check}><span className={classes.radio} data-checked/><Line width={64}/></span>
                        <span className={classes.check}><span className={classes.radio}/><Line width={48}/></span>
                    </>
                )}

                {kind === 'blank' && (
                    <span className={classes.plus}><IconPlus size={20} stroke={2}/></span>
                )}

                {kind === 'custom' && (
                    <>
                        <span className={classes.title}/>
                        <Line/><Line width={88}/><Line/><Line width={60}/><Line/>
                        <span className={classes.accent}/>
                    </>
                )}
            </span>
        </span>
    );
};
