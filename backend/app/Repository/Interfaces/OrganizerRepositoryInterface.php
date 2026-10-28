<?php

declare(strict_types=1);

namespace HiEvents\Repository\Interfaces;

use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Repository\DTO\Organizer\OrganizerAchievementMetricsDTO;
use HiEvents\Repository\DTO\Organizer\OrganizerStatsResponseDTO;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * @extends RepositoryInterface<OrganizerDomainObject>
 */
interface OrganizerRepositoryInterface extends RepositoryInterface
{
    public function getOrganizerStats(int $organizerId, int $accountId, string $currencyCode): OrganizerStatsResponseDTO;

    public function getAchievementMetrics(int $organizerId, string $currencyCode): OrganizerAchievementMetricsDTO;

    public function getSitemapOrganizers(int $page, int $perPage): LengthAwarePaginator;

    public function getSitemapOrganizerCount(): int;
}
