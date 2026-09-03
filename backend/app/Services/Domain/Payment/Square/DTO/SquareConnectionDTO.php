<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Payment\Square\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;
use HiEvents\DomainObjects\AccountSquareCredentialDomainObject;

class SquareConnectionDTO extends BaseDataObject
{
    /**
     * @param SquareLocationDTO[] $locations
     */
    public function __construct(
        public readonly ?AccountSquareCredentialDomainObject $credential,
        public readonly array                                $locations,
        public readonly bool                                 $isOAuthConfigured,
    )
    {
    }
}
