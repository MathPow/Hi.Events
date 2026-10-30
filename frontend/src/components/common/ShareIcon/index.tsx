import {ReactNode, useState} from 'react';
import {ActionIcon, Button, CopyButton, Popover, UnstyledButton} from '@mantine/core';
import {
    IconBrandFacebook,
    IconBrandLinkedin,
    IconBrandWhatsapp,
    IconBrandX,
    IconCheck,
    IconCopy,
    IconMail,
    IconShare
} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import classes from './ShareIcon.module.scss';

interface ShareComponentProps {
    title: string;
    text: string;
    url: string;
    imageUrl?: string;
    shareButtonText?: string;
    hideShareButtonText?: boolean;
    className?: string;
    children?: ReactNode;
}

export const ShareComponent = ({
                                   title,
                                   text,
                                   url,
                                   shareButtonText = t`Share`,
                                   hideShareButtonText = false,
                                   className,
                                   children,
                               }: ShareComponentProps) => {
    const [opened, setOpened] = useState(false);

    let shareText = text;

    const shareData = {
        title,
        text: shareText,
        url,
    };

    const handleShareClick = async () => {
        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (error) {
                console.error('Error sharing:', error);
            }
        } else {
            setOpened(!opened);
        }
    };

    const links = [
        {
            label: 'X',
            icon: IconBrandX,
            href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
        },
        {
            label: 'Facebook',
            icon: IconBrandFacebook,
            href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        },
        {
            label: 'LinkedIn',
            icon: IconBrandLinkedin,
            href: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(shareText)}&source=${encodeURIComponent(typeof window !== "undefined" ? window?.location?.hostname : "")}`,
        },
        {
            label: 'WhatsApp',
            icon: IconBrandWhatsapp,
            href: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${url}`)}`,
        },
        {
            label: t`Email`,
            icon: IconMail,
            href: `mailto:?subject=${encodeURIComponent(title)}&body=${url}`,
        },
    ];

    // Sans partage natif (ordinateur): une carte creme comme le menu du calendrier, les reseaux
    // en ronds et « Copier le lien » en dessous.
    return (
        <Popover
            opened={opened}
            onChange={setOpened}
            position="bottom"
            offset={10}
            classNames={{dropdown: classes.dropdown}}
        >
            <Popover.Target>
                <div style={{display: 'flex'}} onClick={handleShareClick}>
                    {children ? (
                        children
                    ) : hideShareButtonText ? (
                        <ActionIcon variant={'transparent'} className={className}>
                            <IconShare size={20}/>
                        </ActionIcon>
                    ) : (
                        <Button variant={'transparent'} leftSection={<IconShare size={20}/>} className={className}>
                            {shareButtonText}
                        </Button>
                    )}
                </div>
            </Popover.Target>

            <Popover.Dropdown>
                <p className={classes.label}>{t`Share`}</p>
                <div className={classes.networks}>
                    {links.map(({label, icon: Icon, href}) => (
                        <a key={label} className={classes.network} href={href} target="_blank"
                           rel="noopener noreferrer" aria-label={label} title={label}>
                            <Icon size={22} stroke={1.75}/>
                        </a>
                    ))}
                </div>
                <CopyButton value={url}>
                    {({copied, copy}) => (
                        <UnstyledButton className={classes.copy} onClick={copy}>
                            {copied ? <IconCheck size={18} stroke={2}/> : <IconCopy size={18} stroke={2}/>}
                            {copied ? t`Copied!` : t`Copy link`}
                        </UnstyledButton>
                    )}
                </CopyButton>
            </Popover.Dropdown>
        </Popover>
    );
};
