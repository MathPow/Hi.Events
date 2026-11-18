<?php

namespace Tests\Unit\Services\Domain\EventChange;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\Repository\Interfaces\AttendeeRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Domain\EventChange\EventChangeRecipientService;
use Mockery;
use Tests\TestCase;

class EventChangeRecipientServiceTest extends TestCase
{
    public function test_buyers_once_per_order_and_other_participants_once_per_address(): void
    {
        $orderRepository = Mockery::mock(OrderRepositoryInterface::class);
        $orderRepository->shouldReceive('loadRelation')->andReturnSelf();
        $orderRepository->shouldReceive('findWhere')->andReturn(collect([
            (new OrderDomainObject())->setId(2)->setEmail('alex@example.com'),
            (new OrderDomainObject())->setId(1)->setEmail('Alex@Example.com'),
            (new OrderDomainObject())->setId(3)->setEmail('robin@example.com'),
        ]));

        $attendeeRepository = Mockery::mock(AttendeeRepositoryInterface::class);
        $attendeeRepository->shouldReceive('findWhere')->andReturn(collect([
            // The buyer's own ticket: they already get the order's email.
            (new AttendeeDomainObject())->setId(10)->setOrderId(1)->setEmail('alex@example.com'),
            (new AttendeeDomainObject())->setId(11)->setOrderId(1)->setEmail('sam@example.com'),
            // Sam again, on another order: one email.
            (new AttendeeDomainObject())->setId(12)->setOrderId(3)->setEmail(' SAM@example.com '),
            (new AttendeeDomainObject())->setId(13)->setOrderId(3)->setEmail('kim@example.com'),
            // An order that is not standing anymore (cancelled, abandoned).
            (new AttendeeDomainObject())->setId(14)->setOrderId(99)->setEmail('gone@example.com'),
            (new AttendeeDomainObject())->setId(15)->setOrderId(3)->setEmail(''),
        ]));

        $recipients = (new EventChangeRecipientService($orderRepository, $attendeeRepository))->forEvent(5);

        $this->assertSame([1, 2, 3], $recipients->orders->map(fn(OrderDomainObject $order) => $order->getId())->all());
        $this->assertSame([11, 13], $recipients->attendees->map(fn(AttendeeDomainObject $attendee) => $attendee->getId())->all());
        $this->assertSame(5, $recipients->count());
    }
}
