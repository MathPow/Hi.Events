<?php

namespace Tests\Unit\Services\Application\Handlers\User;

use HiEvents\DomainObjects\UserDomainObject;
use HiEvents\Repository\Interfaces\AccountUserRepositoryInterface;
use HiEvents\Repository\Interfaces\UserRepositoryInterface;
use HiEvents\Services\Application\Handlers\User\DTO\UpdateUserMessageEmailsDTO;
use HiEvents\Services\Application\Handlers\User\UpdateUserMessageEmailsHandler;
use Mockery;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;
use Tests\TestCase;

class UpdateUserMessageEmailsHandlerTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function testTurnsTheCopyOnForTheMemberOfThisAccount(): void
    {
        $accountUsers = Mockery::mock(AccountUserRepositoryInterface::class);
        $users = Mockery::mock(UserRepositoryInterface::class);
        $user = (new UserDomainObject())->setId(10);
        $users->shouldReceive('findByIdAndAccountId')->with(10, 3)->andReturn($user);
        $accountUsers->shouldReceive('updateWhere')->once()->with(
            ['receives_organizer_messages' => true],
            ['user_id' => 10, 'account_id' => 3],
        );

        $result = (new UpdateUserMessageEmailsHandler($accountUsers, $users))
            ->handle(new UpdateUserMessageEmailsDTO(user_id: 10, account_id: 3, enabled: true));

        $this->assertSame($user, $result);
    }

    public function testRefusesAUserOfAnotherAccount(): void
    {
        $this->expectException(ResourceNotFoundException::class);

        $accountUsers = Mockery::mock(AccountUserRepositoryInterface::class);
        $users = Mockery::mock(UserRepositoryInterface::class);
        $users->shouldReceive('findByIdAndAccountId')->andThrow(new ResourceNotFoundException('User not found in this account'));
        $accountUsers->shouldNotReceive('updateWhere');

        (new UpdateUserMessageEmailsHandler($accountUsers, $users))
            ->handle(new UpdateUserMessageEmailsDTO(user_id: 99, account_id: 3, enabled: true));
    }
}
