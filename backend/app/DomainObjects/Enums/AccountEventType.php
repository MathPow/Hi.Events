<?php

namespace HiEvents\DomainObjects\Enums;

enum AccountEventType: string
{
    use BaseEnum;

    case SPORT = 'SPORT';
    case ENTREPRENEURSHIP = 'ENTREPRENEURSHIP';
    case SOCIAL = 'SOCIAL';
    case OTHER = 'OTHER';
}
