<?php

namespace HiEvents\Services\Domain\DonationReceipt\DTO;

use HiEvents\DataTransferObjects\BaseDTO;

class DonationBreakdownDTO extends BaseDTO
{
    public function __construct(
        /** Total effectivement encaisse sur les lignes comportant un volet don. */
        public readonly float $totalReceived,
        /** Juste valeur marchande de la contrepartie recue par le donateur. */
        public readonly float $advantageAmount,
        /** Montant admissible au recu = totalReceived - advantageAmount. */
        public readonly float $eligibleAmount,
    )
    {
    }

    public function hasReceiptableGift(): bool
    {
        return $this->eligibleAmount > 0;
    }
}
