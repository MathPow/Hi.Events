<?php

namespace HiEvents\Repository\Interfaces;

use HiEvents\DomainObjects\OrganizerMessageDomainObject;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * @extends RepositoryInterface<OrganizerMessageDomainObject>
 */
interface OrganizerMessageRepositoryInterface extends RepositoryInterface
{
    /**
     * Les messages d'un organisateur, du plus recent au plus ancien.
     */
    public function paginateForOrganizer(int $organizerId, int $perPage, int $page, bool $unreadOnly = false): LengthAwarePaginator;
}
