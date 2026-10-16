<?php

namespace HiEvents\DomainObjects\Enums;

/**
 * Icons an organizer can pick for the information block shown to buyers.
 * Kept in sync with frontend/src/constants/productInfoIcons.ts — update both when adding/removing icons.
 */
enum ProductInfoIcon: string
{
    use BaseEnum;

    case Info = 'info';
    case Heart = 'heart';
    case HeartHandshake = 'heart-handshake';
    case Gift = 'gift';
    case Leaf = 'leaf';
    case Mountain = 'mountain';
    case Speakerphone = 'speakerphone';
    case Star = 'star';
}
