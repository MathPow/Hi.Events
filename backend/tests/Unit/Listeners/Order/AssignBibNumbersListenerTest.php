<?php

namespace Tests\Unit\Listeners\Order;

use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Events\OrderStatusChangedEvent;
use HiEvents\Listeners\Order\AssignBibNumbersListener;
use HiEvents\Services\Domain\Attendee\BibNumberService;
use Mockery as m;
use RuntimeException;
use Tests\TestCase;

class AssignBibNumbersListenerTest extends TestCase
{
    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }

    private function event(OrderStatus $status): OrderStatusChangedEvent
    {
        return new OrderStatusChangedEvent((new OrderDomainObject())->setId(42)->setStatus($status->name));
    }

    public function testNumbersTheAttendeesOfAConfirmedOrder(): void
    {
        $service = m::mock(BibNumberService::class);
        $service->shouldReceive('assignForOrder')->once()->andReturn(2);

        (new AssignBibNumbersListener($service))->handle($this->event(OrderStatus::COMPLETED));

        $this->addToAssertionCount(1);
    }

    public function testWaitsForThePayment(): void
    {
        $service = m::mock(BibNumberService::class);
        $service->shouldNotReceive('assignForOrder');

        (new AssignBibNumbersListener($service))->handle($this->event(OrderStatus::AWAITING_OFFLINE_PAYMENT));

        $this->addToAssertionCount(1);
    }

    public function testAFailureNeverStopsTheSale(): void
    {
        $service = m::mock(BibNumberService::class);
        $service->shouldReceive('assignForOrder')->once()->andThrow(new RuntimeException('database gone'));

        (new AssignBibNumbersListener($service))->handle($this->event(OrderStatus::COMPLETED));

        $this->addToAssertionCount(1);
    }
}
