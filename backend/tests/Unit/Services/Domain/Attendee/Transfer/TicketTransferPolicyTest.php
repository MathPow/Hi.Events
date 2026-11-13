<?php

namespace Tests\Unit\Services\Domain\Attendee\Transfer;

use Carbon\CarbonImmutable;
use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\Enums\TicketTransferRefusal;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\Status\AttendeeStatus;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Exceptions\TicketTransferNotAllowedException;
use HiEvents\Repository\Interfaces\AttendeeCheckInRepositoryInterface;
use HiEvents\Services\Domain\Attendee\Transfer\TicketTransferPolicy;
use Mockery;
use Mockery\MockInterface;
use Tests\TestCase;

class TicketTransferPolicyTest extends TestCase
{
    private AttendeeCheckInRepositoryInterface|MockInterface $checkIns;
    private TicketTransferPolicy $policy;

    protected function setUp(): void
    {
        parent::setUp();

        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-11-12 12:00:00', 'UTC'));

        $this->checkIns = Mockery::mock(AttendeeCheckInRepositoryInterface::class);
        $this->checkIns->shouldReceive('countWhere')->andReturn(0)->byDefault();

        $this->policy = new TicketTransferPolicy($this->checkIns);
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();

        parent::tearDown();
    }

    public function test_a_paid_unused_ticket_can_be_transferred_before_the_cutoff(): void
    {
        $eligibility = $this->policy->eligibility($this->attendee(), $this->order(), $this->event(), $this->settings());

        $this->assertTrue($eligibility->enabled);
        $this->assertTrue($eligibility->isAllowed());
        $this->assertNull($eligibility->refusal);
        $this->assertSame('2026-11-18 14:00:00', $eligibility->deadline);
    }

    public function test_refused_when_the_event_does_not_allow_it(): void
    {
        $eligibility = $this->policy->eligibility($this->attendee(), $this->order(), $this->event(), $this->settings(enabled: false));

        $this->assertFalse($eligibility->enabled);
        $this->assertNull($eligibility->deadline);
        $this->assertSame(TicketTransferRefusal::DISABLED, $eligibility->refusal);
    }

    public function test_refused_without_event_settings(): void
    {
        $eligibility = $this->policy->eligibility($this->attendee(), $this->order(), $this->event(), null);

        $this->assertSame(TicketTransferRefusal::DISABLED, $eligibility->refusal);
    }

    public function test_refused_once_the_cutoff_has_passed(): void
    {
        // Starts in 47 hours, the cutoff is 48.
        $event = $this->event('2026-11-14 11:00:00');

        $this->assertSame(
            TicketTransferRefusal::DEADLINE_PASSED,
            $this->policy->eligibility($this->attendee(), $this->order(), $event, $this->settings())->refusal,
        );
    }

    public function test_refused_exactly_at_the_cutoff(): void
    {
        $event = $this->event('2026-11-14 12:00:00');

        $this->assertSame(
            TicketTransferRefusal::DEADLINE_PASSED,
            $this->policy->eligibility($this->attendee(), $this->order(), $event, $this->settings())->refusal,
        );
    }

    public function test_the_cutoff_follows_the_organizer_choice(): void
    {
        $event = $this->event('2026-11-14 11:00:00');

        $eligibility = $this->policy->eligibility($this->attendee(), $this->order(), $event, $this->settings(cutoffHours: 24));

        $this->assertTrue($eligibility->isAllowed());
        $this->assertSame('2026-11-13 11:00:00', $eligibility->deadline);
    }

    public function test_seven_days_keeps_the_time_of_day_across_a_daylight_saving_change(): void
    {
        // 9:00 in Montreal on November 3, the day after the clocks go back: the cutoff is 9:00 on October 27.
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-01 12:00:00', 'UTC'));
        $event = $this->event('2026-11-03 14:00:00');

        $eligibility = $this->policy->eligibility($this->attendee(), $this->order(), $event, $this->settings(cutoffHours: 168));

        $this->assertSame('2026-10-27 13:00:00', $eligibility->deadline);
    }

    public function test_refused_until_the_order_is_paid(): void
    {
        $order = $this->order(OrderStatus::AWAITING_OFFLINE_PAYMENT->name);

        $this->assertSame(
            TicketTransferRefusal::ORDER_NOT_COMPLETED,
            $this->policy->eligibility($this->attendee(), $order, $this->event(), $this->settings())->refusal,
        );
    }

    public function test_refused_for_a_ticket_awaiting_payment(): void
    {
        $attendee = $this->attendee(status: AttendeeStatus::AWAITING_PAYMENT->name);

        $this->assertSame(
            TicketTransferRefusal::ORDER_NOT_COMPLETED,
            $this->policy->eligibility($attendee, $this->order(), $this->event(), $this->settings())->refusal,
        );
    }

    public function test_refused_for_a_cancelled_ticket(): void
    {
        $attendee = $this->attendee(status: AttendeeStatus::CANCELLED->name);

        $this->assertSame(
            TicketTransferRefusal::TICKET_NOT_ACTIVE,
            $this->policy->eligibility($attendee, $this->order(), $this->event(), $this->settings())->refusal,
        );
    }

    public function test_refused_for_a_ticket_scanned_at_the_entrance(): void
    {
        $this->checkIns->shouldReceive('countWhere')->with(['attendee_id' => 10])->andReturn(1);

        $this->assertSame(
            TicketTransferRefusal::CHECKED_IN,
            $this->policy->eligibility($this->attendee(), $this->order(), $this->event(), $this->settings())->refusal,
        );
    }

    public function test_refused_for_a_ticket_checked_in_by_the_organizer(): void
    {
        $attendee = $this->attendee()->setCheckedInAt('2026-11-10 09:00:00');

        $this->assertSame(
            TicketTransferRefusal::CHECKED_IN,
            $this->policy->eligibility($attendee, $this->order(), $this->event(), $this->settings())->refusal,
        );
    }

    public function test_the_new_email_must_differ_from_the_current_one(): void
    {
        try {
            $this->policy->assertCanTransfer($this->attendee(), $this->order(), $this->event(), $this->settings(), ' LEO@example.com ');
            $this->fail('Expected TicketTransferNotAllowedException');
        } catch (TicketTransferNotAllowedException $exception) {
            $this->assertSame(TicketTransferRefusal::SAME_EMAIL, $exception->refusal);
        }
    }

    public function test_assert_throws_the_refusal(): void
    {
        try {
            $this->policy->assertCanTransfer($this->attendee(), $this->order(), $this->event(), $this->settings(enabled: false), 'marie@example.com');
            $this->fail('Expected TicketTransferNotAllowedException');
        } catch (TicketTransferNotAllowedException $exception) {
            $this->assertSame(TicketTransferRefusal::DISABLED, $exception->refusal);
            $this->assertSame(TicketTransferRefusal::DISABLED->message(), $exception->getMessage());
        }
    }

    public function test_assert_passes_for_an_allowed_transfer(): void
    {
        $this->policy->assertCanTransfer($this->attendee(), $this->order(), $this->event(), $this->settings(), 'marie@example.com');

        $this->addToAssertionCount(1);
    }

    private function attendee(string $status = 'ACTIVE'): AttendeeDomainObject
    {
        return (new AttendeeDomainObject())
            ->setId(10)
            ->setEventId(1)
            ->setOrderId(5)
            ->setStatus($status)
            ->setEmail('leo@example.com');
    }

    private function order(string $status = 'COMPLETED'): OrderDomainObject
    {
        return (new OrderDomainObject())->setId(5)->setStatus($status);
    }

    private function event(string $startDate = '2026-11-20 14:00:00'): EventDomainObject
    {
        return (new EventDomainObject())
            ->setId(1)
            ->setStartDate($startDate)
            ->setTimezone('America/Montreal');
    }

    private function settings(bool $enabled = true, int $cutoffHours = 48): EventSettingDomainObject
    {
        return (new EventSettingDomainObject())
            ->setAllowTicketTransfer($enabled)
            ->setTicketTransferCutoffHours($cutoffHours);
    }
}
