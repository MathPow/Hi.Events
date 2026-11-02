<?php

declare(strict_types=1);

namespace HiEvents\Exceptions;

/** The order has no ticket that can go in a wallet (not paid, cancelled, no ticket). */
class WalletPassUnavailableException extends BaseException
{
}
