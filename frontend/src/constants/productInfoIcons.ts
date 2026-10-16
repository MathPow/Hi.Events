import {t} from "@lingui/macro";
import {
    Icon,
    IconGift,
    IconHeart,
    IconHeartHandshake,
    IconInfoCircle,
    IconLeaf,
    IconMountain,
    IconSpeakerphone,
    IconStar,
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
} satisfies Record<string, Icon>;

export type ProductInfoIconKey = keyof typeof PRODUCT_INFO_ICONS;

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
});
