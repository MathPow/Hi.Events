<?php

namespace HiEvents\Repository\Interfaces;

use HiEvents\DomainObjects\LiveTrackPointDomainObject;

/**
 * @extends RepositoryInterface<LiveTrackPointDomainObject>
 */
interface LiveTrackPointRepositoryInterface extends RepositoryInterface
{
    /**
     * Points already saved for the same moment are skipped.
     *
     * @param array<int, array<string, mixed>> $points
     */
    public function insertIgnoringDuplicates(array $points): int;
}
