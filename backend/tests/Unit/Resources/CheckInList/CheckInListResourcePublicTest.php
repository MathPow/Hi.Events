<?php

namespace Tests\Unit\Resources\CheckInList;

use HiEvents\DomainObjects\CheckInListDomainObject;
use HiEvents\Resources\CheckInList\CheckInListResourcePublic;
use Tests\TestCase;

class CheckInListResourcePublicTest extends TestCase
{
    public function testThePhoneLearnsHowLongThePinIsButNeverThePin(): void
    {
        $list = (new CheckInListDomainObject())->setId(1)->setShortId('cil_abc')->setName('Entrée')->setPin('4821');

        $data = (new CheckInListResourcePublic($list))->toArray(request());

        $this->assertTrue($data['requires_pin']);
        $this->assertSame(4, $data['pin_length']);
        $this->assertArrayNotHasKey('pin', $data);
    }

    public function testAListWithoutPinAsksForNothing(): void
    {
        $list = (new CheckInListDomainObject())->setId(1)->setShortId('cil_abc')->setName('Entrée');

        $data = (new CheckInListResourcePublic($list))->toArray(request());

        $this->assertFalse($data['requires_pin']);
        $this->assertSame(0, $data['pin_length']);
    }
}
