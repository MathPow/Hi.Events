<?php

namespace Tests\Unit\Services\Domain\Payment\Stripe;

use HiEvents\DomainObjects\AccountConfigurationDomainObject;
use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\StripeCustomerDomainObject;
use HiEvents\Repository\Interfaces\StripeCustomerRepositoryInterface;
use HiEvents\Services\Domain\Order\DTO\ApplicationFeeValuesDTO;
use HiEvents\Services\Domain\Order\OrderApplicationFeeCalculationService;
use HiEvents\Services\Domain\Payment\Stripe\DTOs\CreatePaymentIntentRequestDTO;
use HiEvents\Services\Domain\Payment\Stripe\StripePaymentIntentCreationService;
use HiEvents\Values\MoneyValue;
use Illuminate\Config\Repository;
use Illuminate\Database\DatabaseManager;
use Mockery as m;
use Psr\Log\LoggerInterface;
use Stripe\PaymentIntent;
use Stripe\StripeClient;
use Tests\TestCase;

class StripePaymentIntentCreationServiceTest extends TestCase
{
    private StripePaymentIntentCreationService $service;
    private Repository $config;
    private StripeCustomerRepositoryInterface $stripeCustomerRepository;
    private OrderApplicationFeeCalculationService $applicationFeeCalculationService;

    /** @var array{params: array, opts: array}|null */
    private ?array $capturedCall = null;

    protected function setUp(): void
    {
        parent::setUp();

        $logger = m::mock(LoggerInterface::class);
        $logger->shouldIgnoreMissing();

        $this->config = m::mock(Repository::class);
        $this->stripeCustomerRepository = m::mock(StripeCustomerRepositoryInterface::class);
        $this->applicationFeeCalculationService = m::mock(OrderApplicationFeeCalculationService::class);

        $databaseManager = m::mock(DatabaseManager::class);
        $databaseManager->shouldReceive('beginTransaction');
        $databaseManager->shouldReceive('commit');
        $databaseManager->shouldReceive('rollBack');

        $this->service = new StripePaymentIntentCreationService(
            $logger,
            $this->config,
            $this->stripeCustomerRepository,
            $databaseManager,
            $this->applicationFeeCalculationService,
        );
    }

    public function testAddsTheBuyerContributionToTheApplicationFee(): void
    {
        $this->givenSaasMode();
        $this->givenApplicationFee(5.00);

        $this->createPaymentIntent(
            contribution: 2.00,
            stripeAccountId: 'acct_123',
        );

        self::assertSame(700, $this->capturedCall['params']['application_fee_amount']);
        self::assertSame(['stripe_account' => 'acct_123'], $this->capturedCall['opts']);
    }

    public function testChargesTheContributionEvenWhenTheAccountBypassesApplicationFees(): void
    {
        $this->givenSaasMode();
        $this->givenApplicationFee(5.00);

        $configuration = new AccountConfigurationDomainObject();
        $configuration->setBypassApplicationFees(true);

        $this->createPaymentIntent(
            contribution: 2.00,
            stripeAccountId: 'acct_123',
            configuration: $configuration,
        );

        self::assertSame(200, $this->capturedCall['params']['application_fee_amount']);
    }

    public function testChargesOnlyTheApplicationFeeWhenNothingIsContributed(): void
    {
        $this->givenSaasMode();
        $this->givenApplicationFee(5.00);

        $this->createPaymentIntent(
            contribution: 0.0,
            stripeAccountId: 'acct_123',
        );

        self::assertSame(500, $this->capturedCall['params']['application_fee_amount']);
    }

    /**
     * Sans compte connecte la charge est portee par la plateforme: l'argent lui revient
     * deja en entier et Stripe rejette application_fee_amount.
     */
    public function testOmitsTheApplicationFeeWhenChargingOnThePlatformAccount(): void
    {
        $this->givenSaasMode();
        $this->givenApplicationFee(5.00);

        $this->createPaymentIntent(
            contribution: 2.00,
            stripeAccountId: null,
        );

        self::assertArrayNotHasKey('application_fee_amount', $this->capturedCall['params']);
        self::assertSame([], $this->capturedCall['opts']);
    }

    public function testChargesTheOrderTotalWhichAlreadyIncludesTheContribution(): void
    {
        $this->givenSaasMode();
        $this->givenApplicationFee(5.00);

        $this->createPaymentIntent(
            contribution: 2.00,
            stripeAccountId: 'acct_123',
            amount: 52.00,
        );

        self::assertSame(5200, $this->capturedCall['params']['amount']);
    }

    private function givenSaasMode(bool $enabled = true): void
    {
        $this->config->shouldReceive('get')->with('app.saas_mode_enabled')->andReturn($enabled);
    }

    private function givenApplicationFee(float $gross): void
    {
        $this->applicationFeeCalculationService
            ->shouldReceive('calculateApplicationFee')
            ->andReturn(new ApplicationFeeValuesDTO(
                grossApplicationFee: MoneyValue::fromFloat($gross, 'CAD'),
                netApplicationFee: MoneyValue::fromFloat($gross, 'CAD'),
            ));
    }

    private function createPaymentIntent(
        float                             $contribution,
        ?string                           $stripeAccountId,
        ?AccountConfigurationDomainObject $configuration = null,
        float                             $amount = 50.00,
    ): void
    {
        $order = (new OrderDomainObject())
            ->setId(1)
            ->setEventId(2)
            ->setShortId('abc123')
            ->setEmail('buyer@example.com')
            ->setFirstName('Ada')
            ->setLastName('Lovelace')
            ->setPlatformContribution($contribution);

        $account = (new AccountDomainObject())->setId(3);
        $account->setConfiguration($configuration ?? new AccountConfigurationDomainObject());

        $customer = m::mock(StripeCustomerDomainObject::class);
        $customer->shouldReceive('getStripeCustomerId')->andReturn('cus_123');
        $customer->shouldReceive('getName')->andReturn('Ada Lovelace');

        $this->stripeCustomerRepository
            ->shouldReceive('findFirstWhere')
            ->with([
                'email' => 'buyer@example.com',
                'stripe_account_id' => $stripeAccountId,
            ])
            ->andReturn($customer);

        $paymentIntents = m::mock();
        $paymentIntents->shouldReceive('create')
            ->once()
            ->andReturnUsing(function (array $params, array $opts = []) {
                $this->capturedCall = ['params' => $params, 'opts' => $opts];

                return PaymentIntent::constructFrom([
                    'id' => 'pi_123',
                    'client_secret' => 'cs_123',
                ]);
            });

        $stripeClient = m::mock(StripeClient::class);
        $stripeClient->paymentIntents = $paymentIntents;

        $this->service->createPaymentIntentWithClient(
            $stripeClient,
            new CreatePaymentIntentRequestDTO(
                amount: MoneyValue::fromFloat($amount, 'CAD'),
                currencyCode: 'CAD',
                account: $account,
                order: $order,
                stripeAccountId: $stripeAccountId,
            ),
        );
    }
}
