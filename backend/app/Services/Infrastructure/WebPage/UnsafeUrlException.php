<?php

namespace HiEvents\Services\Infrastructure\WebPage;

use Exception;

/** An address the platform refuses to read: not web, internal network, unusual port. */
class UnsafeUrlException extends Exception
{
}
