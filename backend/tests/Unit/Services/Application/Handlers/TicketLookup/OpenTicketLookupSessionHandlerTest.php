<?php

namespace Tests\Unit\Services\Application\Handlers\TicketLookup;

use Carbon\Carbon;
use HiEvents\DomainObjects\TicketLookupTokenDomainObject;
use HiEvents\Exceptions\InvalidTicketLookupTokenException;
use HiEvents\Repository\Interfaces\TicketLookupTokenRepositoryInterface;
use HiEvents\Services\Application\Handlers\TicketLookup\OpenTicketLookupSessionHandler;
use Mockery as m;
use Tests\TestCase;

class OpenTicketLookupSessionHandlerTest extends TestCase
{
    private TicketLookupTokenRepositoryInterface $repository;
    private OpenTicketLookupSessionHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-17 12:00:00');
        $this->repository = m::mock(TicketLookupTokenRepositoryInterface::class);
        $this->handler = new OpenTicketLookupSessionHandler($this->repository);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        m::close();
        parent::tearDown();
    }

    private function token(string $expiresAt): TicketLookupTokenDomainObject
    {
        $record = m::mock(TicketLookupTokenDomainObject::class);
        $record->shouldReceive('getExpiresAt')->andReturn($expiresAt);
        $record->shouldReceive('getEmail')->andReturn('jean@example.com');

        return $record;
    }

    public function testTheLinkGivesItsEmailAndOnlyLastsAFewMoreMinutes(): void
    {
        $this->repository->shouldReceive('findFirstWhere')->with(['token' => 'tl_abc'])
            ->andReturn($this->token('2026-12-10 12:00:00'));
        $this->repository->shouldReceive('updateWhere')->once()
            ->with(['expires_at' => '2026-11-17 12:15:00'], ['token' => 'tl_abc']);

        $this->assertSame('jean@example.com', $this->handler->handle('tl_abc'));
    }

    public function testASecondClickInsideTheGraceKeepsItsEnd(): void
    {
        $this->repository->shouldReceive('findFirstWhere')->andReturn($this->token('2026-11-17 12:10:00'));
        $this->repository->shouldNotReceive('updateWhere');

        $this->assertSame('jean@example.com', $this->handler->handle('tl_abc'));
    }

    public function testAnUnknownLinkIsRefused(): void
    {
        $this->repository->shouldReceive('findFirstWhere')->andReturn(null);

        $this->expectException(InvalidTicketLookupTokenException::class);
        $this->handler->handle('tl_nope');
    }

    public function testAnExpiredLinkIsRefused(): void
    {
        $this->repository->shouldReceive('findFirstWhere')->andReturn($this->token('2026-11-17 11:59:00'));
        $this->repository->shouldNotReceive('updateWhere');

        $this->expectException(InvalidTicketLookupTokenException::class);
        $this->handler->handle('tl_old');
    }
}
