<?php

namespace HiEvents\Repository\Interfaces;

use Carbon\Carbon;
use HiEvents\DomainObjects\AssistantUsageDomainObject;
use Illuminate\Support\Collection;

/**
 * @extends RepositoryInterface<AssistantUsageDomainObject>
 */
interface AssistantUsageRepositoryInterface extends RepositoryInterface
{
    /** Turns, tokens and cost since a date, all accounts together. */
    public function getTotalsSince(Carbon $since): object;

    /** Turns and cost per day (America/Toronto) since a date. */
    public function getDailySince(Carbon $since): Collection;

    /** Turns, people and cost per account since a date, the costliest first. */
    public function getByAccountSince(Carbon $since): Collection;

    /** Turns and cost per person since a date, the costliest first. */
    public function getByUserSince(Carbon $since): Collection;
}
