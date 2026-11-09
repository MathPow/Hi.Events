<?php

namespace Tests\Unit\Services\Domain\Waiver;

use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\Services\Domain\Waiver\ParticipantSigningPolicy;
use Tests\TestCase;

class ParticipantSigningPolicyTest extends TestCase
{
    private ParticipantSigningPolicy $policy;

    protected function setUp(): void
    {
        parent::setUp();

        $this->policy = new ParticipantSigningPolicy();
    }

    public function test_the_buyer_signs_every_ticket_by_default(): void
    {
        $this->assertTrue($this->policy->signsAtCheckout($this->settings(false), 'buyer@example.com', 'friend@example.com'));
    }

    public function test_the_buyer_signs_only_their_own_ticket_when_participants_sign_themselves(): void
    {
        $settings = $this->settings(true);

        $this->assertTrue($this->policy->signsAtCheckout($settings, 'Buyer@Example.com ', ' buyer@example.com'));
        $this->assertFalse($this->policy->signsAtCheckout($settings, 'buyer@example.com', 'friend@example.com'));
        $this->assertFalse($this->policy->signsAtCheckout($settings, 'buyer@example.com', null));
    }

    public function test_details_collected_once_per_order_are_signed_by_the_buyer(): void
    {
        $this->assertTrue($this->policy->signsAtCheckout($this->settings(true, 'PER_ORDER'), 'buyer@example.com', 'friend@example.com'));
    }

    private function settings(bool $participantsSignThemselves, string $collection = 'PER_TICKET'): EventSettingDomainObject
    {
        return (new EventSettingDomainObject())
            ->setParticipantsSignThemselves($participantsSignThemselves)
            ->setAttendeeDetailsCollectionMethod($collection);
    }
}
