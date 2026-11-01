<?php

namespace Tests\Unit\Resources\Account;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\Resources\Account\AccountResource;
use Illuminate\Http\Request;
use Tests\TestCase;

class AccountResourceTest extends TestCase
{
    public function test_exposes_the_stripe_processing_fees_from_the_configuration(): void
    {
        config([
            'services.stripe.processing_fee_percentage' => 2.9,
            'services.stripe.processing_fee_fixed' => 0.30,
        ]);

        $resource = (new AccountResource($this->account()))->toArray(Request::create('/'));

        $this->assertSame(['percentage' => 2.9, 'fixed' => 0.3], $resource['stripe_processing_fees']);
    }

    public function test_stripe_processing_fees_default_to_zero(): void
    {
        config([
            'services.stripe.processing_fee_percentage' => null,
            'services.stripe.processing_fee_fixed' => null,
        ]);

        $resource = (new AccountResource($this->account()))->toArray(Request::create('/'));

        $this->assertSame(['percentage' => 0.0, 'fixed' => 0.0], $resource['stripe_processing_fees']);
    }

    private function account(): AccountDomainObject
    {
        return (new AccountDomainObject())
            ->setId(1)
            ->setName('Dehors')
            ->setEmail('dehors@example.com')
            ->setShortId('acc_1')
            ->setCurrencyCode('CAD');
    }
}
