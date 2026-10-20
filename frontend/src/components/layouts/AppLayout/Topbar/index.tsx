import React from "react";
import {NavLink} from "react-router";
import {Breadcrumbs} from '@mantine/core';
import {IconChevronLeft} from "@tabler/icons-react";
import classes from './Topbar.module.scss';
import {BreadcrumbItem, MobileContext} from "../types";
import {GlobalMenu} from "../../../common/GlobalMenu";
import { getConfig } from "../../../../utilites/config";

interface TopbarProps {
    topBarShadow: boolean;
    breadcrumbItems: BreadcrumbItem[];
    topBarContent?: React.ReactNode;
    breadcrumbContentRight?: React.ReactNode;
    actionGroupContent?: React.ReactNode;
    mobileContext?: MobileContext;
}

export const Topbar: React.FC<TopbarProps> = ({
                                                  topBarShadow,
                                                  breadcrumbItems,
                                                  topBarContent = null,
                                                  breadcrumbContentRight = null,
                                                  actionGroupContent = null,
                                                  mobileContext,
                                              }) => {
    return (
        <div className={`${classes.topBar} ${topBarShadow ? classes.withShadow : ''}`}>
            <div className={classes.topBarShell}>
                <div className={classes.topBarMain}>
                    {mobileContext ? (
                        <div className={classes.mobileContext}>
                            {mobileContext.backLink && (
                                <NavLink to={mobileContext.backLink} className={classes.backLink}
                                         aria-label={typeof mobileContext.subtitle === 'string' ? mobileContext.subtitle : undefined}>
                                    <IconChevronLeft size={20} stroke={2.25}/>
                                </NavLink>
                            )}
                            <div className={classes.mobileTitles}>
                                {mobileContext.subtitle && (
                                    <span className={classes.mobileSubtitle}>{mobileContext.subtitle}</span>
                                )}
                                <span className={classes.mobileTitle}>{mobileContext.title}</span>
                            </div>
                        </div>
                    ) : (
                        <div className={classes.logo}>
                            <NavLink to={ `/manage/events` }>
                                <img src={getConfig("VITE_APP_LOGO_DARK", "/logos/hi-events-text-light.svg")} alt={`${getConfig("VITE_APP_NAME", "Hi.Events")} logo`} className={classes.logo}/>
                            </NavLink>
                        </div>
                    )}

                    {topBarContent}
                    <div className={classes.actionGroup}>
                        {actionGroupContent}

                        <div className={classes.menu}>
                            <GlobalMenu/>
                        </div>
                    </div>
                </div>
            </div>

            <div className={classes.breadcrumbsRow}>
                <div className={classes.breadcrumbs}>
                    <Breadcrumbs separator={<span className={classes.separator}>/</span>}>
                        {breadcrumbItems.map((item, index) => item.link ? (
                            <NavLink key={index} to={item.link}>
                                {item.content}
                            </NavLink>
                        ) : (
                            <span key={index} className={classes.currentPage} aria-current={'page'}>
                                {item.content}
                            </span>
                        ))}
                    </Breadcrumbs>
                </div>
                {breadcrumbContentRight && (
                    <div className={classes.breadcrumbContentRight}>
                        {breadcrumbContentRight}
                    </div>
                )}
            </div>
        </div>
    );
};
