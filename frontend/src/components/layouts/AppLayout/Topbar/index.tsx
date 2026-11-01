import React, {Fragment} from "react";
import {NavLink} from "react-router";
import {t} from "@lingui/macro";
import classNames from "classnames";
import classes from './Topbar.module.scss';
import {BreadcrumbItem} from "../types";
import {PageStatus} from "../PageStatus.tsx";
import {IconAlertTriangle} from "@tabler/icons-react";

interface TopbarProps {
    topBarShadow: boolean;
    breadcrumbItems: BreadcrumbItem[];
    topBarContent?: React.ReactNode;
    // Pages that save by themselves: « Changements enregistrés ».
    saveStatus?: PageStatus['save'];
    actions?: React.ReactNode;
}

// Figma « Enregistrement automatique », left of the page actions (phones too, shorter).
const SaveIndicator = ({status}: { status: NonNullable<PageStatus['save']> }) => {
    if (status.state === 'error') {
        return (
            <button type="button" className={classNames(classes.saveStatus, classes.saveError)} onClick={status.retry}>
                <IconAlertTriangle size={18} stroke={2}/>
                <span>{t`Not saved · Retry`}</span>
            </button>
        );
    }

    if (status.state === 'saving') {
        return <span className={classes.saveStatus} role="status">{t`Saving…`}</span>;
    }

    return (
        <span className={classes.saveStatus} role="status">
            <img src="/interface/admin/parametres/enregistre.svg" alt=""/>
            <span className={classes.saveLabelLong}>{t`Changes saved`}</span>
            <span className={classes.saveLabelShort}>{t({message: 'Saved', context: 'autosave'})}</span>
        </span>
    );
};

// Figma « Admin · Barre du haut » (and its mobile version): the breadcrumbs on the left, the page actions on the right.
export const Topbar: React.FC<TopbarProps> = ({
                                                  topBarShadow,
                                                  breadcrumbItems,
                                                  topBarContent = null,
                                                  saveStatus = null,
                                                  actions = null,
                                              }) => {
    return (
        <header className={classNames(classes.topBar, {[classes.withShadow]: topBarShadow})}
                data-save-status={saveStatus?.state}>
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
            {saveStatus && <SaveIndicator status={saveStatus}/>}
            {actions && <div className={classes.actions}>{actions}</div>}
        </header>
    );
};
