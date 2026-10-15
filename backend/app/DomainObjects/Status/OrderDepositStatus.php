<?php

namespace HiEvents\DomainObjects\Status;

use HiEvents\DomainObjects\Enums\BaseEnum;

enum OrderDepositStatus
{
    use BaseEnum;

    case PENDING;
    case RECEIVED;
    case RETURNED;
    case RETAINED;
}
