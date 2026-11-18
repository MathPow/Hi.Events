<?php

namespace Tests\Unit\Services\Domain\TicketLookup;

use Carbon\Carbon;
use HiEvents\Services\Domain\TicketLookup\TicketLookupSessionService;
use Illuminate\Http\Request;
use Tests\TestCase;

class TicketLookupSessionServiceTest extends TestCase
{
    private TicketLookupSessionService $service;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-17 12:00:00');
        $this->service = app(TicketLookupSessionService::class);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function requestWith(?string $cookie): Request
    {
        return Request::create('/api/public/ticket-lookup', 'GET', [], $cookie === null ? [] : [TicketLookupSessionService::COOKIE => $cookie]);
    }

    public function testTheCookieGivesBackItsEmail(): void
    {
        $cookie = $this->service->makeCookie('Jean@Example.com', $this->requestWith(null));

        $this->assertTrue($cookie->isHttpOnly());
        $this->assertSame('lax', $cookie->getSameSite());
        $this->assertStringNotContainsString('jean', strtolower($cookie->getValue()));
        $this->assertSame('jean@example.com', $this->service->emailFrom($this->requestWith($cookie->getValue())));
    }

    public function testAnExpiredCookieIsIgnored(): void
    {
        $value = $this->service->makeCookie('jean@example.com', $this->requestWith(null))->getValue();
        Carbon::setTestNow('2026-12-18 12:00:00');

        $this->assertNull($this->service->emailFrom($this->requestWith($value)));
    }

    public function testATamperedOrMissingCookieIsIgnored(): void
    {
        $this->assertNull($this->service->emailFrom($this->requestWith(null)));
        $this->assertNull($this->service->emailFrom($this->requestWith('jean@example.com')));
        $this->assertNull($this->service->emailFrom($this->requestWith('tl_abc123')));
    }
}
