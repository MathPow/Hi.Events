import React from "react";
import classes from './ToolBar.module.scss';

interface ToolBarProps {
    children?: React.ReactNode[] | React.ReactNode;
    searchComponent?: () => React.ReactNode;
    filterComponent?: React.ReactNode;
    className?: string;
}

// The search field, the filters and the actions above a list, floating on the page like the
// filters of the organizer's events page (no card around them).
export const ToolBar: React.FC<ToolBarProps> = ({
                                                    searchComponent,
                                                    filterComponent,
                                                    children,
                                                    className,
                                                }) => {
    return (
        <div className={`${classes.card} ${className || ''}`}>
            <div className={classes.wrapper}>
                {searchComponent && (
                    <div className={classes.searchBar}>
                        {searchComponent()}
                    </div>
                )}

                {(filterComponent || children) && (
                    <div className={classes.filterAndActions}>
                        {filterComponent && (
                            <div className={classes.filter}>
                                {filterComponent}
                            </div>
                        )}
                        {children && (
                            <div className={classes.actions}>
                                {children}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
