<?php

namespace HiEvents\Repository\Interfaces;

use HiEvents\DomainObjects\DonationReceiptDomainObject;

/**
 * @extends RepositoryInterface<DonationReceiptDomainObject>
 */
interface DonationReceiptRepositoryInterface extends RepositoryInterface
{
    public function findLatestForOrganizerYear(int $organizerId, int $year): ?DonationReceiptDomainObject;

    public function findIssuedForOrder(int $orderId): ?DonationReceiptDomainObject;
}
