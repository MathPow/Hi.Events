<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\DonationReceiptDomainObject;
use HiEvents\DomainObjects\Status\DonationReceiptStatus;
use HiEvents\Models\DonationReceipt;
use HiEvents\Repository\Interfaces\DonationReceiptRepositoryInterface;

/**
 * @extends BaseRepository<DonationReceiptDomainObject>
 */
class DonationReceiptRepository extends BaseRepository implements DonationReceiptRepositoryInterface
{
    protected function getModel(): string
    {
        return DonationReceipt::class;
    }

    public function getDomainObject(): string
    {
        return DonationReceiptDomainObject::class;
    }

    /**
     * Sert a determiner le prochain numero de la serie. On trie sur l'id et non
     * sur receipt_number: ce dernier est une chaine prefixee, donc son ordre
     * lexicographique ne suit pas l'ordre d'emission (« R-10 » < « R-9 »).
     */
    public function findLatestForOrganizerYear(int $organizerId, int $year): ?DonationReceiptDomainObject
    {
        $receipt = $this->model
            ->where('organizer_id', $organizerId)
            ->where('receipt_year', $year)
            ->orderBy('id', 'desc')
            ->first();

        return $this->handleSingleResult($receipt);
    }

    public function findIssuedForOrder(int $orderId): ?DonationReceiptDomainObject
    {
        $receipt = $this->model
            ->where('order_id', $orderId)
            ->where('status', DonationReceiptStatus::ISSUED->name)
            ->orderBy('id', 'desc')
            ->first();

        return $this->handleSingleResult($receipt);
    }
}
