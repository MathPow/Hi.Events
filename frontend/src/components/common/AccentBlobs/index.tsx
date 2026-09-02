import React from 'react';
import classes from "./AccentBlobs.module.scss";

interface AccentBlobsProps {
    accentColor: string;
    mode: 'light' | 'dark';
}

export const AccentBlobs = ({accentColor, mode}: AccentBlobsProps) => (
    <div
        className={classes.blobs}
        data-mode={mode}
        aria-hidden="true"
        style={{'--blob-accent': accentColor} as React.CSSProperties}
    >
        <span className={`${classes.blob} ${classes.blobA}`}/>
        <span className={`${classes.blob} ${classes.blobB}`}/>
        <span className={`${classes.blob} ${classes.blobC}`}/>
    </div>
);
