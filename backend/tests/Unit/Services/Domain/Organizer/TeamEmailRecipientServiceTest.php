<?php

namespace Tests\Unit\Services\Domain\Organizer;

use HiEvents\DomainObjects\AccountUserDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\Status\UserStatus;
use HiEvents\DomainObjects\UserDomainObject;
use HiEvents\Repository\Interfaces\AccountUserRepositoryInterface;
use HiEvents\Repository\Interfaces\UserRepositoryInterface;
use HiEvents\Services\Domain\Organizer\TeamEmailRecipientService;
use Mockery;
use Mockery\MockInterface;
use Tests\TestCase;

class TeamEmailRecipientServiceTest extends TestCase
{
    private AccountUserRepositoryInterface|MockInterface $accountUserRepository;
    private UserRepositoryInterface|MockInterface $userRepository;
    private TeamEmailRecipientService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->accountUserRepository = Mockery::mock(AccountUserRepositoryInterface::class);
        $this->userRepository = Mockery::mock(UserRepositoryInterface::class);
        $this->service = new TeamEmailRecipientService($this->accountUserRepository, $this->userRepository);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function testReturnsTheActiveMembersWhoAskedForACopy(): void
    {
        $this->accountUserRepository->shouldReceive('findWhere')->once()->with([
            'account_id' => 3,
            'status' => UserStatus::ACTIVE->name,
            'receives_organizer_messages' => true,
        ])->andReturn(collect([$this->accountUser(10), $this->accountUser(11)]));
        $this->userRepository->shouldReceive('findWhereIn')->once()->with('id', [10, 11])->andReturn(collect([
            $this->user(10, 'felix@example.com'),
            $this->user(11, 'mathys@example.com'),
        ]));

        $emails = $this->service->visitorMessageCopies($this->organizer())->map(fn(UserDomainObject $user) => $user->getEmail())->all();

        $this->assertSame(['felix@example.com', 'mathys@example.com'], $emails);
    }

    public function testSkipsTheContactEmailAndDuplicates(): void
    {
        $this->accountUserRepository->shouldReceive('findWhere')->andReturn(collect([
            $this->accountUser(10), $this->accountUser(11), $this->accountUser(12),
        ]));
        $this->userRepository->shouldReceive('findWhereIn')->andReturn(collect([
            $this->user(10, ' Club@Example.com '),
            $this->user(11, 'felix@example.com'),
            $this->user(12, 'FELIX@example.com'),
        ]));

        $emails = $this->service->visitorMessageCopies($this->organizer())->map(fn(UserDomainObject $user) => $user->getEmail())->all();

        $this->assertSame(['felix@example.com'], $emails);
    }

    public function testReturnsNobodyWhenNoMemberAskedForACopy(): void
    {
        $this->accountUserRepository->shouldReceive('findWhere')->andReturn(collect());
        $this->userRepository->shouldNotReceive('findWhereIn');

        $this->assertTrue($this->service->visitorMessageCopies($this->organizer())->isEmpty());
    }

    public function testNewOrderCopiesReadTheirOwnSetting(): void
    {
        $this->accountUserRepository->shouldReceive('findWhere')->once()->with([
            'account_id' => 3,
            'status' => UserStatus::ACTIVE->name,
            'receives_order_notifications' => true,
        ])->andReturn(collect([$this->accountUser(10)]));
        $this->userRepository->shouldReceive('findWhereIn')->once()->with('id', [10])
            ->andReturn(collect([$this->user(10, 'felix@example.com')]));

        $emails = $this->service->newOrderCopies($this->organizer())->map(fn(UserDomainObject $user) => $user->getEmail())->all();

        $this->assertSame(['felix@example.com'], $emails);
    }

    private function organizer(): OrganizerDomainObject
    {
        return (new OrganizerDomainObject())->setId(5)->setAccountId(3)->setEmail('club@example.com');
    }

    private function accountUser(int $userId): AccountUserDomainObject
    {
        return (new AccountUserDomainObject())->setUserId($userId);
    }

    private function user(int $id, string $email): UserDomainObject
    {
        return (new UserDomainObject())->setId($id)->setFirstName('A')->setLastName('B')->setEmail($email);
    }
}
