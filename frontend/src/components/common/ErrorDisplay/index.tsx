import {t} from '@lingui/macro';
import {IconHome, IconRefresh} from '@tabler/icons-react';
import {isRouteErrorResponse, useLocation, useRouteError} from "react-router";
import {ErrorScreen} from "../ErrorScreen";

/**
 * Every route's errorElement: a 404 for an address that leads nowhere, a plain error
 * otherwise. Both stay on the address the visitor typed.
 */
export const ErrorDisplay = () => {
    const error = useRouteError();
    const {pathname} = useLocation();
    const notFound = isRouteErrorResponse(error) && error.status === 404;

    if (!notFound) {
        console.error('ErrorDisplay error:', error);
    }

    if (notFound) {
        return (
            <ErrorScreen
                notFound
                kicker={t`Oops, wrong trail!`}
                title={t`Off trail`}
                pageTitle={t`Page not found`}
                description={t`This page doesn't exist, or it moved. The link may have been cut off when it was copied.`}
                path={pathname}
                primary={{label: t`Back to home`, to: '/', icon: <IconHome size={18}/>}}
                secondary={{label: t`Explore events`, to: '/events'}}
                showTicketsHint
            />
        );
    }

    return (
        <ErrorScreen
            kicker={t`Well, that slipped.`}
            title={t`Something went wrong`}
            description={t`An error occurred while loading the page`}
            primary={{
                label: t`Try again`,
                icon: <IconRefresh size={18}/>,
                onClick: () => window.location.reload(),
            }}
            secondary={{label: t`Back to home`, to: '/'}}
        />
    );
};

export default ErrorDisplay;
