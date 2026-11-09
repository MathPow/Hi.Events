<?php

namespace Tests\Unit\Services\Domain\Event;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use HiEvents\Exceptions\EventNotReadyToPublishException;
use HiEvents\Repository\Interfaces\AccountRepositoryInterface;
use HiEvents\Repository\Interfaces\EventSettingsRepositoryInterface;
use HiEvents\Repository\Interfaces\ProductPriceRepositoryInterface;
use HiEvents\Repository\Interfaces\ProductRepositoryInterface;
use HiEvents\Services\Domain\Event\EventPublishReadinessService;
use HiEvents\Services\Domain\Payment\Stripe\DTOs\StripePayeeDTO;
use HiEvents\Services\Domain\Payment\Stripe\StripePayeeResolutionService;
use Illuminate\Config\Repository as ConfigRepository;
use Illuminate\Support\Collection;
use Mockery as m;
use Tests\TestCase;

class EventPublishReadinessServiceTest extends TestCase
{
    private ProductRepositoryInterface $productRepository;

    private ProductPriceRepositoryInterface $productPriceRepository;

    private EventSettingsRepositoryInterface $eventSettingsRepository;

    private AccountRepositoryInterface $accountRepository;

    private StripePayeeResolutionService $payeeResolutionService;

    private ConfigRepository $config;

    private EventPublishReadinessService $service;

    private EventDomainObject $event;

    protected function setUp(): void
    {
        parent::setUp();

        $this->productRepository = m::mock(ProductRepositoryInterface::class);
        $this->productPriceRepository = m::mock(ProductPriceRepositoryInterface::class);
        $this->eventSettingsRepository = m::mock(EventSettingsRepositoryInterface::class);
        $this->accountRepository = m::mock(AccountRepositoryInterface::class);
        $this->payeeResolutionService = m::mock(StripePayeeResolutionService::class);
        $this->config = m::mock(ConfigRepository::class);

        $this->service = new EventPublishReadinessService(
            $this->productRepository,
            $this->productPriceRepository,
            $this->eventSettingsRepository,
            $this->accountRepository,
            $this->payeeResolutionService,
            $this->config,
        );

        $this->event = (new EventDomainObject)->setId(10)->setAccountId(3)->setOrganizerId(7);
    }

    public function test_rejects_an_event_without_products(): void
    {
        $this->productRepository->shouldReceive('findWhere')->andReturn(new Collection);

        try {
            $this->service->assertCanPublish($this->event);
            $this->fail('Expected EventNotReadyToPublishException');
        } catch (EventNotReadyToPublishException $e) {
            $this->assertSame(EventNotReadyToPublishException::NO_PRODUCTS, $e->reason);
        }
    }

    public function test_allows_a_free_event_without_payments(): void
    {
        $this->givenProductPriced(0);
        $this->eventSettingsRepository->shouldNotReceive('findFirstWhere');

        $this->service->assertCanPublish($this->event);
        $this->addToAssertionCount(1);
    }

    public function test_allows_a_paid_event_with_offline_payments(): void
    {
        $this->givenProductPriced(25);
        $this->givenProviders(['STRIPE', 'OFFLINE']);
        $this->accountRepository->shouldNotReceive('findById');

        $this->service->assertCanPublish($this->event);
        $this->addToAssertionCount(1);
    }

    public function test_rejects_a_paid_event_when_nobody_can_be_paid(): void
    {
        $this->givenProductPriced(25);
        $this->givenProviders(['STRIPE']);
        $this->givenPayee(null, platformPaymentsAllowed: false);

        try {
            $this->service->assertCanPublish($this->event);
            $this->fail('Expected EventNotReadyToPublishException');
        } catch (EventNotReadyToPublishException $e) {
            $this->assertSame(EventNotReadyToPublishException::PAYMENTS_NOT_READY, $e->reason);
        }
    }

    public function test_allows_a_paid_event_with_a_connected_stripe_account(): void
    {
        $this->givenProductPriced(25);
        $this->givenProviders(['STRIPE']);
        $this->givenPayee('acct_123', platformPaymentsAllowed: false);

        $this->service->assertCanPublish($this->event);
        $this->addToAssertionCount(1);
    }

    public function test_allows_a_paid_event_when_platform_payments_are_allowed(): void
    {
        $this->givenProductPriced(25);
        $this->givenProviders(['STRIPE']);
        $this->givenPayee(null, platformPaymentsAllowed: true);

        $this->service->assertCanPublish($this->event);
        $this->addToAssertionCount(1);
    }

    private function givenProductPriced(float $price): void
    {
        $product = (new ProductDomainObject)->setId(1)->setType('PAID');
        $this->productRepository->shouldReceive('findWhere')->andReturn(new Collection([$product]));
        $this->productPriceRepository->shouldReceive('findWhereIn')
            ->with('product_id', [1])
            ->andReturn(new Collection([(new ProductPriceDomainObject)->setPrice($price)]));
    }

    private function givenProviders(array $providers): void
    {
        $this->eventSettingsRepository->shouldReceive('findFirstWhere')
            ->andReturn((new EventSettingDomainObject)->setPaymentProviders($providers));
    }

    private function givenPayee(?string $stripeAccountId, bool $platformPaymentsAllowed): void
    {
        $account = (new AccountDomainObject)->setId(3)->setPlatformPaymentsAllowed($platformPaymentsAllowed);
        $this->accountRepository->shouldReceive('loadRelation')->andReturnSelf();
        $this->accountRepository->shouldReceive('findById')->with(3)->andReturn($account);
        $this->payeeResolutionService->shouldReceive('resolveForOrganizer')->with(7, $account)
            ->andReturn(new StripePayeeDTO($stripeAccountId, null, $stripeAccountId !== null));
        $this->config->shouldReceive('get')->with('app.saas_mode_enabled')->andReturn(true);
    }
}
