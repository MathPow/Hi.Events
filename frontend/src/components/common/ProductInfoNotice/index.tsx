import {IconExternalLink} from "@tabler/icons-react";
import {EventSettings} from "../../../types.ts";
import {getProductInfoIcon} from "../../../constants/productInfoIcons.ts";
import classes from "./ProductInfoNotice.module.scss";

/** The event's information block in a compact form, for the checkout steps. */
export const ProductInfoNotice = ({settings}: { settings?: Partial<EventSettings> }) => {
    const message = settings?.product_info_message;
    const buttonText = settings?.product_info_button_text;
    const buttonUrl = settings?.product_info_button_url;
    const hasButton = !!buttonText && !!buttonUrl;

    if (!message && !hasButton) {
        return null;
    }

    const Icon = getProductInfoIcon(settings?.product_info_icon);

    return (
        <div className={classes.notice}>
            <Icon size={20} stroke={1.75} className={classes.icon} aria-hidden="true"/>
            <div className={classes.body}>
                {message && (
                    <div className={classes.message} dangerouslySetInnerHTML={{__html: message}}/>
                )}
                {hasButton && (
                    <a className={classes.button} href={buttonUrl as string} target="_blank" rel="noopener noreferrer">
                        {buttonText}
                        <IconExternalLink size={14} stroke={1.75} aria-hidden="true"/>
                    </a>
                )}
            </div>
        </div>
    );
};
