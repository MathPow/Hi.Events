<?php

namespace HiEvents\Services\Domain\DonationReceipt\DTO;

use Barryvdh\DomPDF\PDF;
use HiEvents\DataTransferObjects\BaseDTO;

class DonationReceiptPdfResponseDTO extends BaseDTO
{
    public function __construct(
        public readonly PDF    $pdf,
        public readonly string $filename,
    )
    {
    }
}
