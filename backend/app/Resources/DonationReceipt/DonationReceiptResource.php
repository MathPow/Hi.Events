<?php

namespace HiEvents\Resources\DonationReceipt;

use HiEvents\DomainObjects\DonationReceiptDomainObject;
use HiEvents\Resources\BaseResource;
use Illuminate\Http\Request;

/**
 * @mixin DonationReceiptDomainObject
 */
class DonationReceiptResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->getId(),
            'order_id' => $this->getOrderId(),
            'receipt_number' => $this->getReceiptNumber(),
            'issue_date' => $this->getIssueDate(),
            'donation_date' => $this->getDonationDate(),
            'total_received' => $this->getTotalReceived(),
            'advantage_amount' => $this->getAdvantageAmount(),
            'eligible_amount' => $this->getEligibleAmount(),
            'currency' => $this->getCurrency(),
            'status' => $this->getStatus(),
        ];
    }
}
