<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Admin\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class UpdateAccountTrustSettingsDTO extends BaseDataObject
{
    public function __construct(
        public readonly int   $accountId,
        public readonly ?bool $platformPaymentsAllowed = null,
        public readonly ?bool $donationReceiptsAllowed = null,
        public readonly ?bool $suspended = null,
    )
    {
    }
}
