<?php

namespace Tests\Unit\Services\Application\Handlers\Account\Payment\Square;

use HiEvents\Exceptions\Square\SquareOAuthException;
use HiEvents\Services\Application\Handlers\Account\Payment\Square\CompleteSquareAuthorizationHandler;
use HiEvents\Services\Domain\Payment\Square\DTO\SquareConnectionDTO;
use HiEvents\Services\Domain\Payment\Square\SquareConnectionService;
use HiEvents\Services\Infrastructure\Encryption\EncryptedPayloadService;
use Illuminate\Support\Carbon;
use Mockery as m;
use Mockery\MockInterface;
use Tests\TestCase;

class CompleteSquareAuthorizationHandlerTest extends TestCase
{
    private CompleteSquareAuthorizationHandler $handler;
    private MockInterface|SquareConnectionService $connectionService;
    private EncryptedPayloadService $encryptedPayloadService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->connectionService = m::mock(SquareConnectionService::class);
        $this->encryptedPayloadService = app(EncryptedPayloadService::class);

        $this->handler = new CompleteSquareAuthorizationHandler(
            $this->connectionService,
            $this->encryptedPayloadService,
        );
    }

    public function testConnectsWhenTheStateMatchesTheAccount(): void
    {
        $this->connectionService
            ->shouldReceive('connect')
            ->once()
            ->with(5, 'auth-code')
            ->andReturn(new SquareConnectionDTO(credential: null, locations: [], isOAuthConfigured: true));

        $this->handler->handle(5, 'auth-code', $this->makeState(5));
    }

    /**
     * Un code valide renvoye avec le state d'un autre compte brancherait le
     * marchand sur le mauvais compte.
     */
    public function testAStateIssuedForAnotherAccountIsRejected(): void
    {
        $this->connectionService->shouldNotReceive('connect');

        $this->expectException(SquareOAuthException::class);

        $this->handler->handle(5, 'auth-code', $this->makeState(99));
    }

    public function testAnUnreadableStateIsRejected(): void
    {
        $this->connectionService->shouldNotReceive('connect');

        $this->expectException(SquareOAuthException::class);

        $this->handler->handle(5, 'auth-code', 'not-an-encrypted-payload');
    }

    public function testAnExpiredStateIsRejected(): void
    {
        $this->connectionService->shouldNotReceive('connect');

        $expired = $this->encryptedPayloadService->encryptPayload(
            payload: ['account_id' => 5],
            expiry: Carbon::now()->subMinute(),
        );

        $this->expectException(SquareOAuthException::class);

        $this->handler->handle(5, 'auth-code', $expired);
    }

    private function makeState(int $accountId): string
    {
        return $this->encryptedPayloadService->encryptPayload(
            payload: ['account_id' => $accountId, 'user_id' => 1],
            expiry: Carbon::now()->addHour(),
        );
    }
}
