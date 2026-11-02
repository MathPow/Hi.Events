<?php

namespace Tests\Unit\Services\Application\Handlers\Wallet;

use HiEvents\Exceptions\WalletPassUnavailableException;
use HiEvents\Services\Application\Handlers\Wallet\GetAppleWalletPassPublicHandler;
use HiEvents\Services\Application\Handlers\Wallet\GetGoogleWalletPassPublicHandler;
use HiEvents\Services\Domain\Wallet\DTO\WalletOrderDTO;
use HiEvents\Services\Domain\Wallet\WalletPassDataService;
use HiEvents\Services\Infrastructure\Wallet\ApplePassBuilder;
use HiEvents\Services\Infrastructure\Wallet\DTO\WalletFileDTO;
use HiEvents\Services\Infrastructure\Wallet\GoogleWalletService;
use HiEvents\Services\Infrastructure\Wallet\WalletConfig;
use Mockery as m;
use Tests\TestCase;
use Tests\Unit\Services\Infrastructure\Wallet\WalletTestData;

class WalletPassPublicHandlersTest extends TestCase
{
    use WalletTestData;

    public function testAppleWalletWithoutItsAccountIsUnavailable(): void
    {
        $config = m::mock(WalletConfig::class);
        $config->shouldReceive('isAppleEnabled')->andReturnFalse();
        $data = m::mock(WalletPassDataService::class);
        $data->shouldNotReceive('forOrder');

        $this->expectException(WalletPassUnavailableException::class);
        (new GetAppleWalletPassPublicHandler($config, $data, m::mock(ApplePassBuilder::class)))->handle(11, 'o_abc');
    }

    public function testThePassIsBuiltInTheLanguageOfTheOrder(): void
    {
        app()->setLocale('en');
        $order = $this->walletOrder();

        $config = m::mock(WalletConfig::class);
        $config->shouldReceive('isGoogleEnabled')->andReturnTrue();
        $data = m::mock(WalletPassDataService::class);
        $data->shouldReceive('forOrder')->once()->with(11, 'o_abc')->andReturn($order);
        $google = m::mock(GoogleWalletService::class);
        $google->shouldReceive('saveUrl')->once()->with($order)->andReturnUsing(
            fn(WalletOrderDTO $order) => 'https://pay.google.com/gp/v/save/' . app()->getLocale(),
        );

        $url = (new GetGoogleWalletPassPublicHandler($config, $data, $google))->handle(11, 'o_abc');

        $this->assertSame('https://pay.google.com/gp/v/save/fr', $url);
        $this->assertSame('en', app()->getLocale());
    }

    public function testAppleWalletReturnsTheFile(): void
    {
        $order = $this->walletOrder();
        $config = m::mock(WalletConfig::class);
        $config->shouldReceive('isAppleEnabled')->andReturnTrue();
        $data = m::mock(WalletPassDataService::class);
        $data->shouldReceive('forOrder')->andReturn($order);
        $builder = m::mock(ApplePassBuilder::class);
        $builder->shouldReceive('build')->once()->with($order)
            ->andReturn(new WalletFileDTO(content: 'zip', mimeType: ApplePassBuilder::MIME_PASS, filename: 'a.pkpass'));

        $file = (new GetAppleWalletPassPublicHandler($config, $data, $builder))->handle(11, 'o_abc');

        $this->assertSame('a.pkpass', $file->filename);
    }

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }
}
