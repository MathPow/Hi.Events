<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Wallet\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class WalletOrderDTO extends BaseDataObject
{
    /**
     * @param WalletTicketDTO[] $tickets
     */
    public function __construct(
        public readonly string         $orderPublicId,
        public readonly string         $locale,
        public readonly WalletEventDTO $event,
        public readonly array          $tickets,
    )
    {
    }
}
