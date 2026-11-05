import {t} from '@lingui/macro';
import {IconHome} from '@tabler/icons-react';
import React from 'react';
import {ErrorScreen} from "../ErrorScreen";

interface GenericErrorPageProps {
    title: string;
    description: string;
    pageTitle?: string;
    metaDescription?: string;
    buttonText?: string;
    buttonUrl?: string;
    buttonIcon?: React.ReactNode;
}

/**
 * An event or an organizer that isn't there (anymore): the same screen as the 404, with
 * a way back to the events and to one's tickets.
 */
export const GenericErrorPage: React.FC<GenericErrorPageProps> = ({
                                                                      title,
                                                                      description,
                                                                      pageTitle,
                                                                      buttonText,
                                                                      buttonUrl,
                                                                      buttonIcon,
                                                                  }) => {
    const home = {label: t`Back to home`, to: '/', icon: <IconHome size={18}/>};
    const custom = buttonText && buttonUrl ? {label: buttonText, href: buttonUrl, icon: buttonIcon} : null;

    return (
        <ErrorScreen
            notFound
            kicker={t`This trail is closed.`}
            title={title}
            pageTitle={pageTitle}
            description={description}
            primary={custom ?? home}
            secondary={custom ? home : {label: t`Explore events`, to: '/events'}}
            showTicketsHint
        />
    );
};

export default GenericErrorPage;
