<?php

namespace Tests\Unit\Services\Domain\Waiver;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\WaiverDomainObject;
use HiEvents\Repository\Interfaces\WaiverRepositoryInterface;
use HiEvents\Services\Domain\Waiver\WaiverService;
use Illuminate\Database\DatabaseManager;
use Illuminate\Database\UniqueConstraintViolationException;
use Mockery as m;
use Tests\TestCase;

class WaiverServiceTest extends TestCase
{
    private WaiverRepositoryInterface $waiverRepository;
    private DatabaseManager $databaseManager;
    private WaiverService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->waiverRepository = m::mock(WaiverRepositoryInterface::class);
        $this->databaseManager = m::mock(DatabaseManager::class);
        $this->databaseManager->shouldReceive('transaction')->andReturnUsing(fn($callback) => $callback());

        $this->service = new WaiverService($this->waiverRepository, $this->databaseManager);
    }

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }

    private function event(string $startDate = '2027-06-12 12:00:00', string $timezone = 'America/Montreal'): EventDomainObject
    {
        return (new EventDomainObject())->setStartDate($startDate)->setTimezone($timezone);
    }

    public function testAParticipantTurning18OnTheEventDayIsAnAdult(): void
    {
        $this->assertFalse($this->service->isMinorOnEventDay('2009-06-12', $this->event()));
    }

    public function testAParticipantTurning18TheDayAfterIsAMinor(): void
    {
        $this->assertTrue($this->service->isMinorOnEventDay('2009-06-13', $this->event()));
    }

    public function testTheEventDayIsTheLocalDay(): void
    {
        // 02:00 UTC on June 13 is still June 12 in Montreal.
        $event = $this->event('2027-06-13 02:00:00');

        $this->assertTrue($this->service->isMinorOnEventDay('2009-06-13', $event));
    }

    public function testAnUnreadableDateIsNotAMinor(): void
    {
        $this->assertFalse($this->service->isMinorOnEventDay(null, $this->event()));
        $this->assertFalse($this->service->isMinorOnEventDay('12/06/2010', $this->event()));
    }

    public function testReusesAVersionAlreadySigned(): void
    {
        $existing = (new WaiverDomainObject())->setId(4);
        $this->waiverRepository->shouldReceive('findFirstWhere')
            ->once()
            ->with(['event_id' => 1, 'text_hash' => hash('sha256', '<p>Texte</p>')])
            ->andReturn($existing);
        $this->waiverRepository->shouldNotReceive('create');

        $this->assertSame($existing, $this->service->currentVersion(1, '<p>Texte</p>'));
    }

    public function testKeepsANewVersionWithItsText(): void
    {
        $created = (new WaiverDomainObject())->setId(5);
        $this->waiverRepository->shouldReceive('findFirstWhere')->once()->andReturn(null);
        $this->waiverRepository->shouldReceive('create')
            ->once()
            ->with(['event_id' => 1, 'text_hash' => hash('sha256', '<p>Texte</p>'), 'text' => '<p>Texte</p>'])
            ->andReturn($created);

        $this->assertSame($created, $this->service->currentVersion(1, '<p>Texte</p>'));
    }

    public function testFindsTheVersionAnotherOrderJustKept(): void
    {
        $other = (new WaiverDomainObject())->setId(6);
        $this->waiverRepository->shouldReceive('findFirstWhere')->twice()->andReturn(null, $other);
        $this->waiverRepository->shouldReceive('create')
            ->once()
            ->andThrow(m::mock(UniqueConstraintViolationException::class));

        $this->assertSame($other, $this->service->currentVersion(1, '<p>Texte</p>'));
    }
}
