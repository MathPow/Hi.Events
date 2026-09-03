<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\SquarePaymentDomainObject;
use HiEvents\Models\SquarePayment;
use HiEvents\Repository\Interfaces\SquarePaymentsRepositoryInterface;

/**
 * @extends BaseRepository<SquarePaymentDomainObject>
 */
class SquarePaymentsRepository extends BaseRepository implements SquarePaymentsRepositoryInterface
{
    protected function getModel(): string
    {
        return SquarePayment::class;
    }

    public function getDomainObject(): string
    {
        return SquarePaymentDomainObject::class;
    }
}
