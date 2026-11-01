import React from "react";
import classes from './PageBody.module.scss';

interface PageBodyProps {
    children: React.ReactNode,
    isFluid?: boolean,
}

// The content of a back-office page: as wide as the organizer pages (1400px at most).
export const PageBody = ({children, isFluid = true}: PageBodyProps) => {
    return (
        <div className={isFluid ? classes.body : `${classes.body} ${classes.centered}`}>
            {children}
        </div>
    )
}
