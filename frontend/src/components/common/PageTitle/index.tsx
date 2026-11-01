import React from "react";
import classes from './PageTitle.module.scss';

interface PageTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
    children: React.ReactNode,
    // One line explaining the page; a long one is hidden on phones unless mobileSubheading is given.
    subheading?: React.ReactNode,
    mobileSubheading?: React.ReactNode,
    // The page's main actions: on the right on desktop, full width under the title on phones.
    actions?: React.ReactNode,
}

const LONG_SUBHEADING = 70;

// Header of the back-office pages, like the organizer pages rebuilt from Figma « Admin »:
// FatFrank uppercase title (52px, 34px on phones) and an 18px subtitle.
export const PageTitle = (props: PageTitleProps) => {
    const {children, subheading, mobileSubheading, actions, ...rest} = props;
    const hideOnPhones = mobileSubheading !== undefined
        || (typeof subheading === 'string' && subheading.length > LONG_SUBHEADING);

    return (
        <header className={classes.container}>
            <div className={classes.text}>
                <h1 className={classes.title} {...rest}>
                    {children}
                </h1>
                {subheading && (
                    <div className={hideOnPhones ? `${classes.subheading} ${classes.desktopOnly}` : classes.subheading}>
                        {subheading}
                    </div>
                )}
                {mobileSubheading && (
                    <div className={`${classes.subheading} ${classes.mobileOnly}`}>
                        {mobileSubheading}
                    </div>
                )}
            </div>
            {actions && <div className={classes.actions}>{actions}</div>}
        </header>
    );
}
