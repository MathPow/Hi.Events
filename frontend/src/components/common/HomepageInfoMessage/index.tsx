import {Button} from "@mantine/core";
import {IconArrowRight} from "@tabler/icons-react";
import classes from './HomepageInfoMessage.module.scss';
import React from "react";

type StatusType =
    | 'info'
    | 'processing'
    | 'success'
    | 'warning'
    | 'error'
    | 'expired'
    | 'cancelled'
    | 'not_found'
    | 'awaiting_payment'
    | 'offline_payment';

const getStatusEmoji = (status: StatusType): string => {
    const emojis: Record<StatusType, string> = {
        info: '💬',
        processing: '⏳',
        success: '🎉',
        warning: '⚠️',
        error: '❌',
        expired: '⏰',
        cancelled: '😔',
        not_found: '🔍',
        awaiting_payment: '💳',
        offline_payment: '🏦',
    };
    return emojis[status] || emojis.info;
};

interface HomepageInfoMessageProps {
    message: React.ReactNode;
    subtitle?: string;
    link?: string;
    linkText?: string;
    status?: StatusType;
}

export const HomepageInfoMessage = ({
                                        message,
                                        subtitle,
                                        link,
                                        linkText,
                                        status = 'info',
                                    }: HomepageInfoMessageProps) => {
    const emoji = getStatusEmoji(status);

    return (
        <div className={classes.container}>
            <div className={classes.card} data-rough>
                {/* Une commande reussie prend l'autocollant de la page d'accueil, les autres etats leur emoji. */}
                {status === 'success' ? (
                    <img src="/landing/stickers/autocollant-social.svg" alt="" aria-hidden="true"
                         className={classes.sticker}/>
                ) : (
                    <div className={classes.emojiContainer} data-rough>
                        <span className={classes.emoji}>{emoji}</span>
                    </div>
                )}

                <h2 className={classes.title}>{message}</h2>

                {subtitle && (
                    <p className={classes.subtitle}>{subtitle}</p>
                )}

                {(link && linkText) && (
                    <Button
                        component="a"
                        href={link}
                        rightSection={<IconArrowRight size={16}/>}
                        className={classes.button}
                    >
                        {linkText}
                    </Button>
                )}
            </div>
        </div>
    );
};
