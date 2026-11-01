import React, {Fragment} from "react";
import {NavLink} from "react-router";
import {t} from "@lingui/macro";
import classNames from "classnames";
import classes from './Topbar.module.scss';
import {BreadcrumbItem} from "../types";

interface TopbarProps {
    topBarShadow: boolean;
    breadcrumbItems: BreadcrumbItem[];
    topBarContent?: React.ReactNode;
    actions?: React.ReactNode;
}

// Figma « Admin · Barre du haut » (and its mobile version): the breadcrumbs on the left, the page actions on the right.
export const Topbar: React.FC<TopbarProps> = ({
                                                  topBarShadow,
                                                  breadcrumbItems,
                                                  topBarContent = null,
                                                  actions = null,
                                              }) => {
    return (
        <header className={classNames(classes.topBar, {[classes.withShadow]: topBarShadow})}>
            <nav className={classes.breadcrumbs} aria-label={t`Breadcrumb`}>
                {breadcrumbItems.map((item, index) => {
                    const isLast = index === breadcrumbItems.length - 1;

                    return (
                        <Fragment key={index}>
                            {index > 0 && <span className={classes.separator} aria-hidden>/</span>}
                            {isLast || !item.link ? (
                                <span className={classNames(classes.crumb, {[classes.current]: isLast})}
                                      aria-current={isLast ? 'page' : undefined}>
                                    {item.content}
                                </span>
                            ) : (
                                <NavLink to={item.link} className={classes.crumb}>
                                    {item.content}
                                </NavLink>
                            )}
                        </Fragment>
                    );
                })}
            </nav>

            {topBarContent && <div className={classes.topBarContent}>{topBarContent}</div>}
            {actions && <div className={classes.actions}>{actions}</div>}
        </header>
    );
};
