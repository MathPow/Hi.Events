<?php

namespace Tests\Unit\Services\Application\Handlers\Order\Payment\Stripe;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Exceptions\Stripe\CreatePaymentIntentFailedException;
use HiEvents\Repository\Interfaces\AccountRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Repository\Interfaces\StripePaymentsRepositoryInterface;
use HiEvents\Services\Application\Handlers\Order\Payment\Stripe\CreatePaymentIntentHandler;
use HiEvents\Services\Domain\Payment\Stripe\DTOs\StripePayeeDTO;
use HiEvents\Services\Domain\Payment\Stripe\StripePayeeResolutionService;
use HiEvents\Services\Domain\Payment\Stripe\StripePaymentIntentCreationService;
use HiEvents\Services\Infrastructure\Session\CheckoutSessionManagementService;
use HiEvents\Services\Infrastructure\Stripe\StripeClientFactory;
use HiEvents\Services\Infrastructure\Stripe\StripeConfigurationService;
use Illuminate\Config\Repository;
use Mockery;
use RuntimeException;
use Tests\TestCase;

/**
 * Sans compte Stripe Connect, l'argent arriverait sur le compte de la
 * plateforme: seul un compte approuve par un superadmin y a droit.
 */
class CreatePaymentIntentHandlerPlatformAccountTest extends TestCase
{
    public function testAnUnapprovedAccountWithoutConnectCannotChargeThePlatform(): void
    {
        $handler = $this->handler(account: $this->account(platformPaymentsAllowed: false), connectedAccountId: null);

        $this->expectException(CreatePaymentIntentFailedException::class);

        $handler->handle('o_abc');
    }

    public function testAnApprovedAccountWithoutConnectStillChargesThePlatform(): void
    {
        $handler = $this->handler(account: $this->account(platformPaymentsAllowed: true), connectedAccountId: null);

        $this->expectExceptionObject(new RuntimeException('reached Stripe'));

        $handler->handle('o_abc');
    }

    public function testAnUnapprovedAccountWithItsOwnConnectAccountIsCharged(): void
    {
        $handler = $this->handler(account: $this->account(platformPaymentsAllowed: false), connectedAccountId: 'acct_123');

        $this->expectExceptionObject(new RuntimeException('reached Stripe'));

        $handler->handle('o_abc');
    }

    public function testWithoutSaasModeEveryChargeLandsOnThePlatformAndNeedsApproval(): void
    {
        $handler = $this->handler(
            account: $this->account(platformPaymentsAllowed: false),
            connectedAccountId: 'acct_123',
            saasMode: false,
        );

        $this->expectException(CreatePaymentIntentFailedException::class);

        $handler->handle('o_abc');
    }

    private function handler(
        AccountDomainObject $account,
        ?string             $connectedAccountId,
        bool                $saasMode = true,
    ): CreatePaymentIntentHandler
    {
        $event = Mockery::mock(EventDomainObject::class);
        $event->shouldReceive('getOrganizerId')->andReturn(3);

        $order = Mockery::mock(OrderDomainObject::class);
        $order->shouldReceive('getSessionId')->andReturn('session');
        $order->shouldReceive('getStatus')->andReturn(OrderStatus::RESERVED->name);
        $order->shouldReceive('isReservedOrderExpired')->andReturnFalse();
        $order->shouldReceive('getEventId')->andReturn(2);
        $order->shouldReceive('getEvent')->andReturn($event);

        $orderRepository = Mockery::mock(OrderRepositoryInterface::class);
        $orderRepository->shouldReceive('loadRelation')->andReturnSelf();
        $orderRepository->shouldReceive('findByShortId')->with('o_abc')->andReturn($order);

        $sessionService = Mockery::mock(CheckoutSessionManagementService::class);
        $sessionService->shouldReceive('verifySession')->andReturnTrue();

        $accountRepository = Mockery::mock(AccountRepositoryInterface::class);
        $accountRepository->shouldReceive('loadRelation')->andReturnSelf();
        $accountRepository->shouldReceive('findByEventId')->with(2)->andReturn($account);

        $payeeResolutionService = Mockery::mock(StripePayeeResolutionService::class);
        $payeeResolutionService->shouldReceive('resolveForOrganizer')->andReturn(new StripePayeeDTO(
            stripeAccountId: $connectedAccountId,
            platform: null,
            isOrganizerAccount: false,
        ));

        $stripeConfigurationService = Mockery::mock(StripeConfigurationService::class);
        $stripeConfigurationService->shouldReceive('getPrimaryPlatform')->andReturnNull();

        $stripeClientFactory = Mockery::mock(StripeClientFactory::class);
        $stripeClientFactory->shouldReceive('createForPlatform')->andThrow(new RuntimeException('reached Stripe'));

        return new CreatePaymentIntentHandler(
            orderRepository: $orderRepository,
            stripePaymentService: Mockery::mock(StripePaymentIntentCreationService::class),
            sessionIdentifierService: $sessionService,
            stripePaymentsRepository: Mockery::mock(StripePaymentsRepositoryInterface::class),
            accountRepository: $accountRepository,
            stripeClientFactory: $stripeClientFactory,
            stripeConfigurationService: $stripeConfigurationService,
            payeeResolutionService: $payeeResolutionService,
            config: new Repository(['app' => ['saas_mode_enabled' => $saasMode]]),
        );
    }

    private function account(bool $platformPaymentsAllowed): AccountDomainObject
    {
        return (new AccountDomainObject())
            ->setId(1)
            ->setPlatformPaymentsAllowed($platformPaymentsAllowed);
    }
}
