<?php

namespace Tests\Unit\Services\Application\Handlers\User;

use HiEvents\DomainObjects\UserDomainObject;
use HiEvents\Repository\Interfaces\AccountUserRepositoryInterface;
use HiEvents\Repository\Interfaces\UserRepositoryInterface;
use HiEvents\Services\Application\Handlers\User\DTO\UpdateUserNotificationEmailsDTO;
use HiEvents\Services\Application\Handlers\User\UpdateUserNotificationEmailsHandler;
use Mockery;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;
use Tests\TestCase;

class UpdateUserNotificationEmailsHandlerTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function testTurnsOnlyTheGivenSettingOnForTheMemberOfThisAccount(): void
    {
        $accountUsers = Mockery::mock(AccountUserRepositoryInterface::class);
        $users = Mockery::mock(UserRepositoryInterface::class);
        $user = (new UserDomainObject())->setId(10);
        $users->shouldReceive('findByIdAndAccountId')->with(10, 3)->andReturn($user);
        $accountUsers->shouldReceive('updateWhere')->once()->with(
            ['receives_order_notifications' => true],
            ['user_id' => 10, 'account_id' => 3],
        );

        $result = (new UpdateUserNotificationEmailsHandler($accountUsers, $users))
            ->handle(new UpdateUserNotificationEmailsDTO(user_id: 10, account_id: 3, new_orders: true));

        $this->assertSame($user, $result);
    }

    public function testUpdatesBothSettingsTogether(): void
    {
        $accountUsers = Mockery::mock(AccountUserRepositoryInterface::class);
        $users = Mockery::mock(UserRepositoryInterface::class);
        $users->shouldReceive('findByIdAndAccountId')->andReturn((new UserDomainObject())->setId(10));
        $accountUsers->shouldReceive('updateWhere')->once()->with(
            ['receives_organizer_messages' => false, 'receives_order_notifications' => true],
            ['user_id' => 10, 'account_id' => 3],
        );

        (new UpdateUserNotificationEmailsHandler($accountUsers, $users))
            ->handle(new UpdateUserNotificationEmailsDTO(user_id: 10, account_id: 3, organizer_messages: false, new_orders: true));

        $this->addToAssertionCount(1);
    }

    public function testRefusesAUserOfAnotherAccount(): void
    {
        $this->expectException(ResourceNotFoundException::class);

        $accountUsers = Mockery::mock(AccountUserRepositoryInterface::class);
        $users = Mockery::mock(UserRepositoryInterface::class);
        $users->shouldReceive('findByIdAndAccountId')->andThrow(new ResourceNotFoundException('User not found in this account'));
        $accountUsers->shouldNotReceive('updateWhere');

        (new UpdateUserNotificationEmailsHandler($accountUsers, $users))
            ->handle(new UpdateUserNotificationEmailsDTO(user_id: 99, account_id: 3, organizer_messages: true));
    }
}
