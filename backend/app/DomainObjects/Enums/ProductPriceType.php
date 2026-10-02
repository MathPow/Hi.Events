<?php

namespace HiEvents\DomainObjects\Enums;

enum ProductPriceType
{
    use BaseEnum;

    case PAID;
    case FREE;
    case DONATION;
    case TIERED;
    case REGISTRATION;
    case SIZED;

    public function hasMultiplePrices(): bool
    {
        return $this === self::TIERED || $this === self::SIZED;
    }
}
