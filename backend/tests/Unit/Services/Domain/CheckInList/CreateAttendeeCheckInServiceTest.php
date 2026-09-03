<?php

namespace Tests\Unit\Services\Domain\CheckInList;

use HiEvents\DomainObjects\AttendeeCheckInDomainObject;
use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\CheckInListDomainObject;
use HiEvents\DomainObjects\Enums\AttendeeCheckInActionType;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\Status\AttendeeStatus;
use HiEvents\Repository\Interfaces\AttendeeCheckInRepositoryInterface;
use HiEvents\Repository\Interfaces\EventSettingsRepositoryInterface;
use HiEvents\Services\Application\Handlers\CheckInList\Public\DTO\AttendeeAndActionDTO;
use HiEvents\Services\Domain\CheckInList\CheckInListDataService;
use HiEvents\Services\Domain\CheckInList\CreateAttendeeCheckInService;
use HiEvents\Services\Domain\Order\MarkOrderAsPaidService;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Mockery;
use PDOException;
use Tests\TestCase;

class CreateAttendeeCheckInServiceTest extends TestCase
{
    private AttendeeCheckInRepositoryInterface $attendeeCheckInRepository;

    protected function setUp(): void
    {
        parent::setUp();

        $this->attendeeCheckInRepository = Mockery::mock(AttendeeCheckInRepositoryInterface::class);
    }

    public function test_it_refuses_a_ticket_that_is_already_checked_in(): void
    {
        $this->attendeeCheckInRepository
            ->shouldReceive('findWhereIn')
            ->andReturn(collect([$this->existingCheckIn()]));

        $this->attendeeCheckInRepository->shouldNotReceive('create');

        $response = $this->service()->checkInAttendees(
            checkInListUuid: 'cil_abc',
            checkInUserIpAddress: '127.0.0.1',
            attendeesAndActions: $this->attendeesAndActions(),
        );

        $this->assertNotEmpty($response->errors->toArray());
        $this->assertStringContainsString('already checked in', json_encode($response->errors->toArray()));
    }

    public function test_a_concurrent_scan_losing_the_race_is_reported_as_already_checked_in(): void
    {
        // Two devices scanning the same QR at the same moment both pass the read above, so the
        // unique index on (attendee_id, check_in_list_id) is what actually enforces single use.
        $this->attendeeCheckInRepository
            ->shouldReceive('findWhereIn')
            ->andReturn(collect());

        $this->attendeeCheckInRepository
            ->shouldReceive('create')
            ->once()
            ->andThrow($this->uniqueConstraintViolation());

        $this->attendeeCheckInRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->andReturn($this->existingCheckIn());

        $response = $this->service()->checkInAttendees(
            checkInListUuid: 'cil_abc',
            checkInUserIpAddress: '127.0.0.1',
            attendeesAndActions: $this->attendeesAndActions(),
        );

        $this->assertStringContainsString('already checked in', json_encode($response->errors->toArray()));
        $this->assertCount(1, $response->attendeeCheckIns);
    }

    public function test_a_first_scan_is_recorded(): void
    {
        $this->attendeeCheckInRepository
            ->shouldReceive('findWhereIn')
            ->andReturn(collect());

        $this->attendeeCheckInRepository
            ->shouldReceive('create')
            ->once()
            ->andReturn($this->existingCheckIn());

        $response = $this->service()->checkInAttendees(
            checkInListUuid: 'cil_abc',
            checkInUserIpAddress: '127.0.0.1',
            attendeesAndActions: $this->attendeesAndActions(),
        );

        $this->assertEmpty($response->errors->toArray());
        $this->assertCount(1, $response->attendeeCheckIns);
    }

    private function service(): CreateAttendeeCheckInService
    {
        $connection = Mockery::mock(ConnectionInterface::class);
        $connection->shouldReceive('transaction')->andReturnUsing(static fn(callable $callback) => $callback());

        $eventSettingsRepository = Mockery::mock(EventSettingsRepositoryInterface::class);
        $eventSettingsRepository->shouldReceive('findFirstWhere')->andReturn(
            (new EventSettingDomainObject())
                ->setId(1)
                ->setEventId(1)
                ->setAllowOrdersAwaitingOfflinePaymentToCheckIn(false)
        );

        return new CreateAttendeeCheckInService(
            attendeeCheckInRepository: $this->attendeeCheckInRepository,
            checkInListDataService: $this->checkInListDataService(),
            eventSettingsRepository: $eventSettingsRepository,
            db: $connection,
            markOrderAsPaidService: Mockery::mock(MarkOrderAsPaidService::class)->shouldIgnoreMissing(),
        );
    }

    private function checkInListDataService(): CheckInListDataService
    {
        $service = Mockery::mock(CheckInListDataService::class);
        $service->shouldReceive('getCheckInList')->andReturn(
            (new CheckInListDomainObject())->setId(1)->setEventId(1)->setShortId('cil_abc')->setName('Door')
        );
        $service->shouldReceive('getAttendees')->andReturn(collect([$this->attendee()]));
        $service->shouldReceive('verifyAttendeeBelongsToCheckInList')->andReturnNull();

        return $service;
    }

    private function attendee(): AttendeeDomainObject
    {
        return (new AttendeeDomainObject())
            ->setId(7)
            ->setEventId(1)
            ->setOrderId(1)
            ->setProductId(1)
            ->setProductPriceId(1)
            ->setPublicId('A-AAAAAAA')
            ->setShortId('a_aaaaaaa')
            ->setFirstName('Alex')
            ->setLastName('Tremblay')
            ->setEmail('alex@example.com')
            ->setStatus(AttendeeStatus::ACTIVE->name);
    }

    private function existingCheckIn(): AttendeeCheckInDomainObject
    {
        return (new AttendeeCheckInDomainObject())
            ->setId(1)
            ->setAttendeeId(7)
            ->setCheckInListId(1)
            ->setEventId(1)
            ->setProductId(1)
            ->setShortId('ci_abc');
    }

    private function attendeesAndActions()
    {
        return collect([
            new AttendeeAndActionDTO(
                public_id: 'A-AAAAAAA',
                action: AttendeeCheckInActionType::CHECK_IN,
            ),
        ]);
    }

    private function uniqueConstraintViolation(): UniqueConstraintViolationException
    {
        return new UniqueConstraintViolationException(
            'pgsql',
            'insert into attendee_check_ins ...',
            [],
            new PDOException('duplicate key value violates unique constraint'),
        );
    }
}
