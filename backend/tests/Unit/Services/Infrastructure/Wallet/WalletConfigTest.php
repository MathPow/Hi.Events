<?php

namespace Tests\Unit\Services\Infrastructure\Wallet;

use HiEvents\Exceptions\WalletPassFailedException;
use HiEvents\Services\Infrastructure\Wallet\WalletConfig;
use Tests\TestCase;

class WalletConfigTest extends TestCase
{
    use WalletTestData;

    public function testAWalletWithoutItsAccountIsHidden(): void
    {
        config(['services.apple_wallet.certificate' => null, 'services.google_wallet.issuer_id' => '']);

        $this->assertFalse(app(WalletConfig::class)->isAppleEnabled());
        $this->assertFalse(app(WalletConfig::class)->isGoogleEnabled());
    }

    public function testReadsTheCertificateFromAP12(): void
    {
        [$certificatePem, , $key, $certificate] = $this->selfSignedPem();
        openssl_pkcs12_export($certificate, $p12, $key, 'secret');
        config(['services.apple_wallet' => [
            'pass_type_identifier' => 'pass.test.dehors',
            'team_identifier' => 'TEAM123456',
            'certificate' => base64_encode($p12),
            'certificate_password' => 'secret',
        ]]);

        $config = app(WalletConfig::class);

        $this->assertTrue($config->isAppleEnabled());
        $this->assertSame(
            openssl_x509_fingerprint($certificatePem),
            openssl_x509_fingerprint($config->appleSigningCredentials()->certificate),
        );
    }

    public function testAWrongPasswordFails(): void
    {
        [, , $key, $certificate] = $this->selfSignedPem();
        openssl_pkcs12_export($certificate, $p12, $key, 'secret');
        config([
            'services.apple_wallet.certificate' => base64_encode($p12),
            'services.apple_wallet.certificate_password' => 'nope',
        ]);

        $this->expectException(WalletPassFailedException::class);
        app(WalletConfig::class)->appleSigningCredentials();
    }

    public function testTheGooglePrefixComesFromTheSiteAddress(): void
    {
        config(['app.frontend_url' => 'https://dev-billets.dehorsqc.com/']);

        $this->assertSame('dev-billets-dehorsqc-com', app(WalletConfig::class)->googleResourcePrefix());
    }
}
