<?php

namespace Tests\Unit\Services\Domain\Payment\Square;

use HiEvents\DomainObjects\AccountSquareCredentialDomainObject;
use HiEvents\DomainObjects\Enums\SquareEnvironment;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\SquarePaymentDomainObject;
use HiEvents\Exceptions\Square\CreateSquarePaymentFailedException;
use HiEvents\Exceptions\Square\SquareApiException;
use HiEvents\Exceptions\Square\SquareNotConnectedException;
use HiEvents\Repository\Interfaces\SquarePaymentsRepositoryInterface;
use HiEvents\Services\Domain\Payment\Square\SquareOAuthService;
use HiEvents\Services\Domain\Payment\Square\SquarePaymentService;
use HiEvents\Services\Infrastructure\Square\SquareClient;
use HiEvents\Services\Infrastructure\Square\SquareClientFactory;
use HiEvents\Services\Infrastructure\Square\SquareConfigurationService;
use Illuminate\Config\Repository;
use Mockery as m;
use Mockery\MockInterface;
use Psr\Log\LoggerInterface;
use Tests\TestCase;

class SquarePaymentServiceTest extends TestCase
{
    private SquarePaymentService $service;
    private MockInterface|SquareClient $client;
    private MockInterface|SquarePaymentsRepositoryInterface $paymentsRepository;
    private MockInterface|Repository $config;
    private ?array $capturedPayload = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->client = m::mock(SquareClient::class);
        $this->paymentsRepository = m::mock(SquarePaymentsRepositoryInterface::class);
        $this->config = m::mock(Repository::class);

        $clientFactory = m::mock(SquareClientFactory::class);
        $clientFactory->shouldReceive('createForCredential')->andReturn($this->client);

        $configurationService = m::mock(SquareConfigurationService::class);
        $configurationService->shouldReceive('getFallbackLocationId')->andReturnNull();

        $oAuthService = m::mock(SquareOAuthService::class);
        $oAuthService->shouldReceive('ensureFreshTokens')->andReturnUsing(fn($c) => $c);

        $this->service = new SquarePaymentService(
            clientFactory: $clientFactory,
            configurationService: $configurationService,
            squarePaymentsRepository: $this->paymentsRepository,
            oAuthService: $oAuthService,
            config: $this->config,
            logger: m::mock(LoggerInterface::class)->shouldIgnoreMissing(),
        );
    }

    public function testChargesTheOrderTotalInMinorUnitsWithAnIdempotencyKey(): void
    {
        $this->givenProcessingFeePercentage(2.9);
        $this->givenPendingPayment();
        $this->givenSuccessfulSquareResponse();

        $this->service->charge($this->makeOrder(52.15), $this->makeCredential(), 'cnon:card-nonce');

        self::assertSame(5215, $this->capturedPayload['amount_money']['amount']);
        self::assertSame('CAD', $this->capturedPayload['amount_money']['currency']);
        self::assertSame('idem-key-1', $this->capturedPayload['idempotency_key']);
        self::assertSame('L1', $this->capturedPayload['location_id']);
    }

    /**
     * La contribution n'appartient pas a l'organisateur: la plateforme lui rend
     * la part variable des frais qu'elle ajoute a la transaction.
     */
    public function testThePlatformAbsorbsTheProcessingCostOfTheContribution(): void
    {
        $this->givenProcessingFeePercentage(2.9);
        $this->givenPendingPayment();
        $this->givenSuccessfulSquareResponse();

        $this->service->charge($this->makeOrder(2.00, contribution: 1.00), $this->makeCredential(), 'cnon:x');

        self::assertSame(97, $this->capturedPayload['app_fee_money']['amount']);
    }

    public function testNoApplicationFeeIsSentWhenNothingIsContributed(): void
    {
        $this->givenProcessingFeePercentage(2.9);
        $this->givenPendingPayment();
        $this->givenSuccessfulSquareResponse();

        $this->service->charge($this->makeOrder(2.00, contribution: 0.0), $this->makeCredential(), 'cnon:x');

        self::assertArrayNotHasKey('app_fee_money', $this->capturedPayload);
    }

    /**
     * Sans marchand autorise, la charge est deja sur le compte de la plateforme
     * et Square rejette app_fee_money.
     */
    public function testNoApplicationFeeIsSentOnASingleMerchantInstallation(): void
    {
        $this->givenProcessingFeePercentage(2.9);
        $this->givenPendingPayment(locationId: 'L-env');
        $this->givenSuccessfulSquareResponse();

        $configurationService = m::mock(SquareConfigurationService::class);
        $configurationService->shouldReceive('getFallbackLocationId')->andReturn('L-env');

        $clientFactory = m::mock(SquareClientFactory::class);
        $clientFactory->shouldReceive('createForCredential')->andReturn($this->client);

        $oAuthService = m::mock(SquareOAuthService::class);
        $oAuthService->shouldReceive('ensureFreshTokens')->andReturnNull();

        $service = new SquarePaymentService(
            clientFactory: $clientFactory,
            configurationService: $configurationService,
            squarePaymentsRepository: $this->paymentsRepository,
            oAuthService: $oAuthService,
            config: $this->config,
            logger: m::mock(LoggerInterface::class)->shouldIgnoreMissing(),
        );

        $service->charge($this->makeOrder(2.00, contribution: 1.00), null, 'cnon:x');

        self::assertArrayNotHasKey('app_fee_money', $this->capturedPayload);
    }

    public function testAnUnconfiguredLocationIsRefusedBeforeCallingSquare(): void
    {
        $this->client->shouldNotReceive('createPayment');

        $this->expectException(SquareNotConnectedException::class);

        $this->service->charge($this->makeOrder(2.00), null, 'cnon:x');
    }

    public function testAFailedPaymentIsRecordedAndReported(): void
    {
        $this->givenProcessingFeePercentage(0.0);
        $this->givenPendingPayment();

        $this->client->shouldReceive('createPayment')->andThrow(new SquareApiException('CARD_DECLINED'));

        $this->paymentsRepository
            ->shouldReceive('updateFromArray')
            ->once()
            ->withArgs(fn(int $id, array $attributes) => $attributes['last_error']['message'] === 'CARD_DECLINED')
            ->andReturn(new SquarePaymentDomainObject());

        $this->expectException(CreateSquarePaymentFailedException::class);

        $this->service->charge($this->makeOrder(2.00), $this->makeCredential(), 'cnon:x');
    }

    private function givenProcessingFeePercentage(float $percentage): void
    {
        $this->config
            ->shouldReceive('get')
            ->with('services.square.processing_fee_percentage', 0)
            ->andReturn($percentage);
    }

    private function givenPendingPayment(string $locationId = 'L1'): void
    {
        $pending = (new SquarePaymentDomainObject())
            ->setId(11)
            ->setIdempotencyKey('idem-key-1')
            ->setLocationId($locationId);

        $this->paymentsRepository->shouldReceive('findFirstWhere')->andReturn($pending);
    }

    private function givenSuccessfulSquareResponse(): void
    {
        $this->client
            ->shouldReceive('createPayment')
            ->once()
            ->andReturnUsing(function (array $payload) {
                $this->capturedPayload = $payload;

                return ['payment' => [
                    'id' => 'sqpmt_1',
                    'status' => 'COMPLETED',
                    'amount_money' => ['amount' => $payload['amount_money']['amount']],
                    'card_details' => ['card' => ['card_brand' => 'VISA', 'last_4' => '1111']],
                ]];
            });

        $this->paymentsRepository
            ->shouldReceive('updateFromArray')
            ->andReturn(new SquarePaymentDomainObject());
    }

    private function makeOrder(float $total, float $contribution = 0.0): OrderDomainObject
    {
        return (new OrderDomainObject())
            ->setId(5)
            ->setShortId('o_abc123')
            ->setTotalGross($total)
            ->setPlatformContribution($contribution)
            ->setCurrency('CAD');
    }

    private function makeCredential(): AccountSquareCredentialDomainObject
    {
        return (new AccountSquareCredentialDomainObject())
            ->setId(3)
            ->setAccountId(1)
            ->setEnvironment(SquareEnvironment::SANDBOX->value)
            ->setMerchantId('MERCHANT-1')
            ->setLocationId('L1')
            ->setAccessToken('token');
    }
}
