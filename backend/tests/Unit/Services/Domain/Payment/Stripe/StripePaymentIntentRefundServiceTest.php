<?php

namespace Tests\Unit\Services\Domain\Payment\Stripe;

use Closure;
use HiEvents\DomainObjects\StripePaymentDomainObject;
use HiEvents\Services\Domain\Payment\Stripe\StripePaymentIntentRefundService;
use HiEvents\Values\MoneyValue;
use Illuminate\Config\Repository;
use Mockery as m;
use Psr\Log\LoggerInterface;
use Stripe\Exception\ApiConnectionException;
use Stripe\PaymentIntent;
use Stripe\Refund;
use Stripe\StripeClient;
use Tests\TestCase;

class StripePaymentIntentRefundServiceTest extends TestCase
{
    private StripePaymentIntentRefundService $service;
    private Repository $config;
    private LoggerInterface $logger;

    protected function setUp(): void
    {
        parent::setUp();

        $this->config = m::mock(Repository::class);
        $this->logger = m::mock(LoggerInterface::class);

        $this->service = new StripePaymentIntentRefundService(
            $this->config,
            $this->logger,
        );
    }

    public function testRefundsOnThePlatformAccountWhenSaasModeIsDisabled(): void
    {
        $this->config->shouldReceive('get')->with('app.saas_mode_enabled')->andReturn(false);

        $payment = $this->makePayment(connectedAccountId: 'acct_123');

        $stripeClient = m::mock(StripeClient::class);
        $refunds = m::mock();
        $stripeClient->refunds = $refunds;

        $refunds->shouldReceive('create')
            ->once()
            ->withArgs($this->refundArgs([
                'payment_intent' => 'pi_123',
                'amount' => 1000,
            ], []))
            ->andReturn(new Refund());

        $this->service->refundPayment(
            MoneyValue::fromFloat(10.00, 'CAD'),
            $payment,
            $stripeClient,
        );
    }

    public function testRefundsOnThePlatformAccountWhenThePaymentHasNoConnectedAccount(): void
    {
        $this->config->shouldReceive('get')->with('app.saas_mode_enabled')->andReturn(true);

        $payment = $this->makePayment(connectedAccountId: null);

        $this->logger->shouldReceive('info')->once();

        $stripeClient = m::mock(StripeClient::class);
        $refunds = m::mock();
        $stripeClient->refunds = $refunds;

        $refunds->shouldReceive('create')
            ->once()
            ->withArgs($this->refundArgs([
                'payment_intent' => 'pi_123',
                'amount' => 1000,
            ], []))
            ->andReturn(new Refund());

        $this->service->refundPayment(
            MoneyValue::fromFloat(10.00, 'CAD'),
            $payment,
            $stripeClient,
        );
    }

    public function testRefundsTheApplicationFeeOnAConnectedAccountCharge(): void
    {
        $this->config->shouldReceive('get')->with('app.saas_mode_enabled')->andReturn(true);

        $payment = $this->makePayment(connectedAccountId: 'acct_123');

        $stripeClient = m::mock(StripeClient::class);
        $refunds = m::mock();
        $paymentIntents = m::mock();
        $stripeClient->refunds = $refunds;
        $stripeClient->paymentIntents = $paymentIntents;

        $paymentIntents->shouldReceive('retrieve')
            ->once()
            ->withArgs($this->retrieveArgs('pi_123', ['stripe_account' => 'acct_123']))
            ->andReturn(PaymentIntent::constructFrom(['application_fee_amount' => 250]));

        $refunds->shouldReceive('create')
            ->once()
            ->withArgs($this->refundArgs([
                'payment_intent' => 'pi_123',
                'amount' => 1000,
                'refund_application_fee' => true,
            ], ['stripe_account' => 'acct_123']))
            ->andReturn(new Refund());

        $this->service->refundPayment(
            MoneyValue::fromFloat(10.00, 'CAD'),
            $payment,
            $stripeClient,
        );
    }

    public function testDoesNotRefundTheApplicationFeeWhenTheChargeCarriesNone(): void
    {
        $this->config->shouldReceive('get')->with('app.saas_mode_enabled')->andReturn(true);

        $payment = $this->makePayment(connectedAccountId: 'acct_123');

        $stripeClient = m::mock(StripeClient::class);
        $refunds = m::mock();
        $paymentIntents = m::mock();
        $stripeClient->refunds = $refunds;
        $stripeClient->paymentIntents = $paymentIntents;

        $paymentIntents->shouldReceive('retrieve')
            ->once()
            ->andReturn(PaymentIntent::constructFrom(['application_fee_amount' => 0]));

        $refunds->shouldReceive('create')
            ->once()
            ->withArgs($this->refundArgs([
                'payment_intent' => 'pi_123',
                'amount' => 1000,
            ], ['stripe_account' => 'acct_123']))
            ->andReturn(new Refund());

        $this->service->refundPayment(
            MoneyValue::fromFloat(10.00, 'CAD'),
            $payment,
            $stripeClient,
        );
    }

    public function testFallsBackToTheStoredFeeWhenThePaymentIntentCannotBeRead(): void
    {
        $this->config->shouldReceive('get')->with('app.saas_mode_enabled')->andReturn(true);

        $payment = $this->makePayment(connectedAccountId: 'acct_123', applicationFeeGross: 150);

        $this->logger->shouldReceive('warning')->once();

        $stripeClient = m::mock(StripeClient::class);
        $refunds = m::mock();
        $paymentIntents = m::mock();
        $stripeClient->refunds = $refunds;
        $stripeClient->paymentIntents = $paymentIntents;

        $paymentIntents->shouldReceive('retrieve')
            ->once()
            ->andThrow(ApiConnectionException::factory('Stripe is unreachable'));

        $refunds->shouldReceive('create')
            ->once()
            ->withArgs($this->refundArgs([
                'payment_intent' => 'pi_123',
                'amount' => 1000,
                'refund_application_fee' => true,
            ], ['stripe_account' => 'acct_123']))
            ->andReturn(new Refund());

        $this->service->refundPayment(
            MoneyValue::fromFloat(10.00, 'CAD'),
            $payment,
            $stripeClient,
        );
    }

    /**
     * Le service appelle Stripe avec des arguments nommes, que Mockery recoit dans un
     * tableau a cles. On normalise pour comparer sans dependre de cette forme.
     */
    private function refundArgs(array $params, array $opts): Closure
    {
        return static fn(...$args): bool => ($args['params'] ?? $args[0] ?? null) === $params
            && ($args['opts'] ?? $args[1] ?? null) === $opts;
    }

    private function retrieveArgs(string $id, array $opts): Closure
    {
        return static fn(...$args): bool => ($args['id'] ?? $args[0] ?? null) === $id
            && ($args['opts'] ?? $args[2] ?? null) === $opts;
    }

    private function makePayment(?string $connectedAccountId, int $applicationFeeGross = 0): StripePaymentDomainObject
    {
        $payment = m::mock(StripePaymentDomainObject::class);
        $payment->shouldReceive('getPaymentIntentId')->andReturn('pi_123');
        $payment->shouldReceive('getConnectedAccountId')->andReturn($connectedAccountId);
        $payment->shouldReceive('getOrderId')->andReturn(1);
        $payment->shouldReceive('getApplicationFeeGross')->andReturn($applicationFeeGross);

        return $payment;
    }
}
