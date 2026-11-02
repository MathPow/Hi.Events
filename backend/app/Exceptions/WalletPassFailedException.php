<?php

declare(strict_types=1);

namespace HiEvents\Exceptions;

/** The wallet is not set up, or Apple / Google refused the pass. */
class WalletPassFailedException extends BaseException
{
}
