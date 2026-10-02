<?php

namespace Tests\Unit\Services\Domain\Order;

use Brick\Money\Currency;
use HiEvents\DomainObjects\AccountConfigurationDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\Services\Domain\Order\OrderPlatformFeePassThroughService;
use HiEvents\Services\Domain\Order\OrderProcessingFeePassThroughService;
use HiEvents\Services\Infrastructure\CurrencyConversion\CurrencyConversionClientInterface;
use HiEvents\Values\MoneyValue;
use Illuminate\Config\Repository;
use Mockery as m;
use Tests\TestCase;

class OrderProcessingFeePassThroughServiceTest extends TestCase
{
    private const STRIPE_RATE = 2.9;
    private const STRIPE_FIXED = 0.30;
    private const PLATFORM_RATE = 5.0;
    private const PLATFORM_FIXED = 0.50;

    private array $configValues;
    private OrderPlatformFeePassThroughService $platformFeeService;
    private OrderProcessingFeePassThroughService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->configValues = [
            'app.saas_mode_enabled' => true,
            'services.stripe.processing_fee_percentage' => self::STRIPE_RATE,
            'services.stripe.processing_fee_fixed' => self::STRIPE_FIXED,
        ];

        $config = m::mock(Repository::class);
        $config->shouldReceive('get')->andReturnUsing(
            fn(string $key, $default = null) => $this->configValues[$key] ?? $default
        );

        $currencyConversionClient = m::mock(CurrencyConversionClientInterface::class);
        $currencyConversionClient->shouldReceive('convert')->andReturnUsing(
            fn(Currency $from, Currency $to, float $amount) => MoneyValue::fromFloat($amount, $to->getCurrencyCode())
        );

        $this->platformFeeService = new OrderPlatformFeePassThroughService($config, $currencyConversionClient);
        $this->service = new OrderProcessingFeePassThroughService($config, $this->platformFeeService);
    }

    public function testReturnsZeroWhenDisabled(): void
    {
        $fee = $this->service->calculateProcessingFee(
            $this->accountConfig(), $this->eventSettings(passProcessingFee: false), 50.0, 1, 'CAD'
        );

        $this->assertSame(0.0, $fee);
    }

    public function testReturnsZeroForFreeItems(): void
    {
        $fee = $this->service->calculateProcessingFee(
            $this->accountConfig(), $this->eventSettings(), 0.0, 2, 'CAD'
        );

        $this->assertSame(0.0, $fee);
    }

    public function testOrganizerNetsTicketPriceWithoutSaasMode(): void
    {
        $this->configValues['app.saas_mode_enabled'] = false;

        $fee = $this->service->calculateProcessingFee(
            $this->accountConfig(), $this->eventSettings(), 50.0, 1, 'CAD'
        );

        $this->assertSame(1.80, $fee);
        $this->assertOrganizerNets(50.0, 50.0 + $fee, 1, platformRate: 0, platformFixed: 0);
    }

    public function testFixedFeeIsChargedPerTicket(): void
    {
        $this->configValues['app.saas_mode_enabled'] = false;

        $fee = $this->service->calculateProcessingFee(
            $this->accountConfig(), $this->eventSettings(), 100.0, 4, 'CAD'
        );

        $this->assertOrganizerNets(100.0, 100.0 + $fee, 4, platformRate: 0, platformFixed: 0);
        $this->assertEqualsWithDelta((100 + 4 * self::STRIPE_FIXED) / (1 - self::STRIPE_RATE / 100) - 100, $fee, 0.01);
    }

    public function testOrganizerNetsTicketPriceWhenPlatformFeeIsAlsoPassed(): void
    {
        $accountConfig = $this->accountConfig();
        $eventSettings = $this->eventSettings(passPlatformFee: true);

        $platformFee = $this->platformFeeService->calculatePlatformFee($accountConfig, $eventSettings, 50.0, 2, 'CAD');
        $processingFee = $this->service->calculateProcessingFee($accountConfig, $eventSettings, 50.0, 2, 'CAD', $platformFee);

        $this->assertGreaterThan(0, $processingFee);
        $this->assertOrganizerNets(50.0, 50.0 + $platformFee + $processingFee, 2);
    }

    public function testOrganizerNetsWhatTheyWouldHaveWhenPlatformFeeIsAbsorbed(): void
    {
        $processingFee = $this->service->calculateProcessingFee(
            $this->accountConfig(), $this->eventSettings(passPlatformFee: false), 50.0, 1, 'CAD'
        );

        $netWithoutPassThrough = 50.0 - (50.0 * self::PLATFORM_RATE / 100) - self::PLATFORM_FIXED;

        $this->assertOrganizerNets($netWithoutPassThrough, 50.0 + $processingFee, 1);
    }

    private function assertOrganizerNets(
        float  $expected,
        float  $buyerTotal,
        int    $quantity,
        ?float $platformRate = self::PLATFORM_RATE,
        ?float $platformFixed = self::PLATFORM_FIXED,
    ): void
    {
        $stripeTakes = ($buyerTotal * self::STRIPE_RATE / 100) + (self::STRIPE_FIXED * $quantity);
        $platformTakes = ($buyerTotal * $platformRate / 100) + ($platformFixed * $quantity);

        $this->assertEqualsWithDelta($expected, $buyerTotal - $stripeTakes - $platformTakes, 0.01);
    }

    private function accountConfig(): AccountConfigurationDomainObject
    {
        $config = m::mock(AccountConfigurationDomainObject::class);
        $config->shouldReceive('getPercentageApplicationFee')->andReturn(self::PLATFORM_RATE);
        $config->shouldReceive('getFixedApplicationFee')->andReturn(self::PLATFORM_FIXED);
        $config->shouldReceive('getApplicationFeeCurrency')->andReturn('CAD');

        return $config;
    }

    private function eventSettings(bool $passProcessingFee = true, bool $passPlatformFee = false): EventSettingDomainObject
    {
        $settings = m::mock(EventSettingDomainObject::class);
        $settings->shouldReceive('getPassProcessingFeeToBuyer')->andReturn($passProcessingFee);
        $settings->shouldReceive('getPassPlatformFeeToBuyer')->andReturn($passPlatformFee);

        return $settings;
    }
}
