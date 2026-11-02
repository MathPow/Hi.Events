<?php

namespace Tests\Unit\Services\Application\Handlers\CheckInList;

use HiEvents\DomainObjects\CheckInListDomainObject;
use HiEvents\Http\DTO\QueryParamsDTO;
use HiEvents\Repository\DTO\CheckedInAttendeesCountDTO;
use HiEvents\Repository\DTO\LastCheckInDTO;
use HiEvents\Repository\Interfaces\CheckInListRepositoryInterface;
use HiEvents\Services\Application\Handlers\CheckInList\DTO\GetCheckInListsDTO;
use HiEvents\Services\Application\Handlers\CheckInList\GetCheckInListsHandler;
use Illuminate\Pagination\LengthAwarePaginator;
use Mockery;
use Tests\TestCase;

class GetCheckInListsHandlerTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function testAddsTheCountsAndTheLatestArrivalOfEachList(): void
    {
        $entrance = (new CheckInListDomainObject())->setId(1);
        $volunteers = (new CheckInListDomainObject())->setId(2);

        $repository = Mockery::mock(CheckInListRepositoryInterface::class);
        $repository->shouldReceive('loadRelation')->andReturnSelf();
        $repository->shouldReceive('findByEventId')
            ->andReturn(new LengthAwarePaginator(collect([$entrance, $volunteers]), 2, 25));
        $repository->shouldReceive('getCheckedInAttendeeCountByIds')->with([1, 2])->andReturn(collect([
            new CheckedInAttendeesCountDTO(checkInListId: 1, checkedInCount: 38, totalAttendeesCount: 100),
            new CheckedInAttendeesCountDTO(checkInListId: 2, checkedInCount: 0, totalAttendeesCount: 15),
        ]));
        $repository->shouldReceive('getLastCheckInsByIds')->with([1, 2])->andReturn(collect([
            new LastCheckInDTO(checkInListId: 1, checkedInAt: '2026-11-07 12:03:00', attendeeName: 'Olivier Gagnon'),
        ]));

        (new GetCheckInListsHandler($repository))->handle(new GetCheckInListsDTO(
            eventId: 9,
            queryParams: new QueryParamsDTO(),
        ));

        $this->assertSame(38, $entrance->getCheckedInCount());
        $this->assertSame(100, $entrance->getTotalAttendeesCount());
        $this->assertSame('Olivier Gagnon', $entrance->getLastCheckIn()?->attendeeName);
        $this->assertSame(15, $volunteers->getTotalAttendeesCount());
        $this->assertNull($volunteers->getLastCheckIn());
    }
}
