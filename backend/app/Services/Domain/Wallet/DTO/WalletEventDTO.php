<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Wallet\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;
use HiEvents\DomainObjects\ImageDomainObject;

/** What every pass of the event shows, in the language of the order, like the event page. */
class WalletEventDTO extends BaseDataObject
{
    public function __construct(
        public readonly int                $eventId,
        public readonly string             $title,
        public readonly string             $organizerName,
        public readonly ?string            $supportEmail,
        public readonly ?string            $eventUrl,
        public readonly string             $backgroundColor,
        public readonly string             $foregroundColor,
        public readonly string             $labelColor,
        public readonly ?string            $startDate,
        public readonly ?string            $endDate,
        public readonly ?string            $shortDate,
        public readonly ?string            $dateTimeLine,
        public readonly ?string            $dateLine,
        public readonly ?string            $timezoneLine,
        public readonly ?string            $placeLine,
        public readonly ?string            $addressLine,
        public readonly ?ImageDomainObject $logo,
        public readonly ?ImageDomainObject $cover,
    )
    {
    }
}
