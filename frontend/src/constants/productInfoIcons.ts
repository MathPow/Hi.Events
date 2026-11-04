import {t} from "@lingui/macro";
import {
    Icon,
    IconAlertCircle,
    IconGift,
    IconHeart,
    IconHeartHandshake,
    IconInfoCircle,
    IconLeaf,
    IconMountain,
    IconSpeakerphone,
    IconStar,
    IconTag,
} from "@tabler/icons-react";

/**
 * Icons an organizer can pick for the information block.
 * Kept in sync with backend/app/DomainObjects/Enums/ProductInfoIcon.php — update both when adding/removing icons.
 */
export const PRODUCT_INFO_ICONS = {
    'info': IconInfoCircle,
    'heart': IconHeart,
    'heart-handshake': IconHeartHandshake,
    'gift': IconGift,
    'leaf': IconLeaf,
    'mountain': IconMountain,
    'speakerphone': IconSpeakerphone,
    'star': IconStar,
    'alert': IconAlertCircle,
    'tag': IconTag,
} satisfies Record<string, Icon>;

export type ProductInfoIconKey = keyof typeof PRODUCT_INFO_ICONS;

// The choices of « Bloc d'info » (Figma 560:3392); the others stay valid for the blocks that use them.
export const PRODUCT_INFO_ICON_CHOICES: ProductInfoIconKey[] = ['heart', 'alert', 'star', 'tag'];

export const DEFAULT_PRODUCT_INFO_ICON: ProductInfoIconKey = 'info';

export const getProductInfoIcon = (key?: string | null): Icon =>
    PRODUCT_INFO_ICONS[key as ProductInfoIconKey] ?? PRODUCT_INFO_ICONS[DEFAULT_PRODUCT_INFO_ICON];

export const getProductInfoIconLabels = (): Record<ProductInfoIconKey, string> => ({
    'info': t`Information`,
    'heart': t`Heart`,
    'heart-handshake': t`Helping hand`,
    'gift': t`Gift`,
    'leaf': t`Leaf`,
    'mountain': t`Mountain`,
    'speakerphone': t`Announcement`,
    'star': t`Star`,
    'alert': t`Important`,
    'tag': t`Tag`,
});
