import {useState} from "react";
import {t} from "@lingui/macro";
import {Button, Collapse, Menu, Switch, TextInput} from "@mantine/core";
import {DraftSocialLink} from "./homepageDraft.ts";
import {SOCIAL_PLATFORMS, socialPlatformIcon, socialPlatformLabel, socialPlatformLink} from "./socialPlatforms.ts";
import {SortableRow, SortableRows} from "./SortableRows.tsx";
import classes from "./OrganizerHomepageDesigner.module.scss";

interface SocialLinksSectionProps {
    links: DraftSocialLink[];
    onChange: (links: DraftSocialLink[]) => void;
    disabled?: boolean;
}

// Same handles as Settings → Social Links; here, which ones the page shows and in what order.
export const SocialLinksSection = ({links, onChange, disabled}: SocialLinksSectionProps) => {
    const [editing, setEditing] = useState<string | null>(null);
    const [added, setAdded] = useState<string | null>(null);
    const available = SOCIAL_PLATFORMS.filter(platform => !links.some(link => link.platform === platform));

    const update = (platform: string, values: Partial<DraftSocialLink>) =>
        onChange(links.map(link => link.platform === platform ? {...link, ...values} : link));

    const add = (platform: string) => {
        onChange([...links, {platform, handle: '', visible: true}]);
        setEditing(platform);
        setAdded(platform);
    };

    const remove = (platform: string) => {
        onChange(links.filter(link => link.platform !== platform));
        setEditing(null);
    };

    return (
        <>
            {links.length > 0 && (
                <SortableRows items={links} getId={link => link.platform} onReorder={onChange}>
                    {(link) => {
                        const label = socialPlatformLabel(link.platform);
                        const Icon = socialPlatformIcon(link.platform);
                        const handle = link.handle.trim();
                        const isEditing = editing === link.platform;

                        return (
                            <SortableRow key={link.platform} id={link.platform} gripSize={18}>
                                {(grip) => (
                                    <>
                                        <div className={classes.rowMain}>
                                            {grip}
                                            <span className={classes.rowPastille}>
                                                <Icon size={16} stroke={2}/>
                                            </span>
                                            <button
                                                type="button"
                                                className={classes.rowLabel}
                                                aria-expanded={isEditing}
                                                onClick={() => setEditing(isEditing ? null : link.platform)}
                                            >
                                                <span className={classes.rowTitle}>{label}</span>
                                                <span className={classes.rowHint}>
                                                    {handle
                                                        ? socialPlatformLink(link.platform, handle) ?? handle
                                                        : t`Add your username`}
                                                </span>
                                            </button>
                                            <Switch
                                                className={classes.switch}
                                                withThumbIndicator={false}
                                                checked={link.visible}
                                                disabled={disabled}
                                                aria-label={t`Show ${label} on my page`}
                                                onChange={(event) => update(link.platform, {visible: event.currentTarget.checked})}
                                            />
                                        </div>
                                        <Collapse in={isEditing}>
                                            <div className={classes.rowEdit}>
                                                <TextInput
                                                    className={classes.field}
                                                    label={t`Username`}
                                                    value={link.handle}
                                                    maxLength={255}
                                                    disabled={disabled}
                                                    autoFocus={added === link.platform}
                                                    onChange={(event) => update(link.platform, {handle: event.currentTarget.value})}
                                                />
                                                <div className={classes.rowEditActions}>
                                                    <button
                                                        type="button"
                                                        className={`${classes.textButton} ${classes.removeButton}`}
                                                        disabled={disabled}
                                                        onClick={() => remove(link.platform)}
                                                    >
                                                        {t`Remove`}
                                                    </button>
                                                    <Button className={classes.doneButton} onClick={() => setEditing(null)}>
                                                        {t`Done`}
                                                    </Button>
                                                </div>
                                            </div>
                                        </Collapse>
                                    </>
                                )}
                            </SortableRow>
                        );
                    }}
                </SortableRows>
            )}

            {available.length > 0 && (
                <Menu position="bottom-start" disabled={disabled}>
                    <Menu.Target>
                        <button type="button" className={classes.textButton} disabled={disabled}>
                            <img src="/interface/admin/ma-page/plus-accent.svg" alt=""/>
                            {t`Add a network`}
                        </button>
                    </Menu.Target>
                    <Menu.Dropdown className={classes.platformMenu}>
                        {available.map(platform => {
                            const Icon = socialPlatformIcon(platform);
                            return (
                                <Menu.Item key={platform} leftSection={<Icon size={18} stroke={2}/>}
                                           onClick={() => add(platform)}>
                                    {socialPlatformLabel(platform)}
                                </Menu.Item>
                            );
                        })}
                    </Menu.Dropdown>
                </Menu>
            )}
        </>
    );
};
