<?php

namespace Tests\Unit\Mail\EventChange;

use HiEvents\DomainObjects\EventCancellationDomainObject;
use HiEvents\DomainObjects\EventDateChangeDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\Status\EventChangeRefundStatus;
use HiEvents\Helper\Currency;
use HiEvents\Mail\EventChange\EventCancelledMail;
use HiEvents\Mail\EventChange\EventPostponedMail;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Services\Domain\Mail\EventEmailBrandingService;
use Illuminate\Config\Repository;
use Mockery;
use Tests\TestCase;

class EventChangeMailsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        app()->setLocale('en');
        $eventRepository = Mockery::mock(EventRepositoryInterface::class);
        $eventRepository->shouldReceive('loadRelation')->andReturnSelf();
        $eventRepository->shouldReceive('findFirst')->andReturnNull();
        $this->app->instance(EventEmailBrandingService::class, new EventEmailBrandingService(app(Repository::class), $eventRepository));
    }

    public function test_the_postponed_email_shows_the_message_the_new_date_and_the_refund_button(): void
    {
        $html = $this->postponedMail('https://billets.test/order/5/ORD1/refund-request?change=7&token=abc')->render();

        $this->assertStringContainsString('Tempête &lt;b&gt;de neige&lt;/b&gt;<br>', $html);
        $this->assertStringContainsString('Saturday, November 21, 2026 9:00 AM (EST)', $html);
        $this->assertStringContainsString('https://billets.test/order/5/ORD1/refund-request?change=7&amp;token=abc', $html);
        $this->assertStringContainsString('I can no longer come: refund me', $html);
        $this->assertStringContainsString('Thursday, November 19, 2026 9:00 AM (EST)', $html);
    }

    public function test_without_a_link_the_postponed_email_has_no_refund_button(): void
    {
        $html = $this->postponedMail(null)->render();

        $this->assertStringNotContainsString('I can no longer come: refund me', $html);
        $this->assertStringContainsString('View Event Page', $html);
    }

    public function test_the_cancelled_email_says_how_much_is_refunded(): void
    {
        $html = $this->cancelledMail(EventChangeRefundStatus::REFUNDED, 42.5)->render();

        $this->assertStringContainsString('You will be refunded ' . e(Currency::format(42.5, 'CAD')), $html);
    }

    public function test_the_cancelled_email_to_a_participant_says_nothing_about_money(): void
    {
        $html = $this->cancelledMail(null, 0.0)->render();

        $this->assertStringNotContainsString('refunded', $html);
        $this->assertStringContainsString('will not take place', $html);
    }

    private function event(): EventDomainObject
    {
        return (new EventDomainObject())
            ->setId(5)
            ->setTitle('Trail du Mont')
            ->setCurrency('CAD')
            ->setTimezone('America/Toronto')
            ->setStartDate('2026-11-21 14:00:00');
    }

    private function postponedMail(?string $refundUrl): EventPostponedMail
    {
        return new EventPostponedMail(
            event: $this->event(),
            organizer: (new OrganizerDomainObject())->setName('Club Dehors')->setEmail('club@example.com'),
            eventSettings: (new EventSettingDomainObject())->setSupportEmail('club@example.com'),
            dateChange: (new EventDateChangeDomainObject())
                ->setMessage("Tempête <b>de neige</b>\nOn se reprend.")
                ->setNewStartDate('2026-11-21 14:00:00')
                ->setRefundDeadline('2026-11-19 14:00:00'),
            firstName: 'Alex',
            refundUrl: $refundUrl,
        );
    }

    private function cancelledMail(?EventChangeRefundStatus $status, float $amount): EventCancelledMail
    {
        return new EventCancelledMail(
            event: $this->event(),
            organizer: (new OrganizerDomainObject())->setName('Club Dehors')->setEmail('club@example.com'),
            eventSettings: (new EventSettingDomainObject())->setSupportEmail('club@example.com'),
            cancellation: (new EventCancellationDomainObject())->setMessage('Verglas.'),
            firstName: 'Alex',
            refundStatus: $status,
            refundAmount: $amount,
        );
    }
}
