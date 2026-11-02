<?php

namespace Tests\Unit\Services\Infrastructure\Wallet;

use HiEvents\Services\Infrastructure\Wallet\ApplePassBuilder;
use Tests\TestCase;

class ApplePassBuilderTest extends TestCase
{
    use WalletTestData;

    private string $certificatePem;

    protected function setUp(): void
    {
        parent::setUp();

        [$certificatePem, $keyPem] = $this->selfSignedPem();
        $this->certificatePem = $certificatePem;

        config(['services.apple_wallet' => [
            'pass_type_identifier' => 'pass.test.dehors',
            'team_identifier' => 'TEAM123456',
            'certificate' => base64_encode($certificatePem . $keyPem),
            'certificate_password' => '',
        ]]);
        app()->setLocale('fr');
    }

    public function testASignedPassWithTheEventAndTheQrCode(): void
    {
        $file = app(ApplePassBuilder::class)->build($this->walletOrder());

        $this->assertSame(ApplePassBuilder::MIME_PASS, $file->mimeType);
        $this->assertSame('backyard-boreal.pkpass', $file->filename);

        $files = $this->unzip($file->content);
        foreach (['pass.json', 'manifest.json', 'signature', 'icon.png', 'icon@2x.png', 'icon@3x.png', 'logo.png'] as $name) {
            $this->assertArrayHasKey($name, $files);
        }

        $manifest = json_decode($files['manifest.json'], true);
        foreach ($manifest as $name => $hash) {
            $this->assertSame(sha1($files[$name]), $hash, $name);
        }
        $this->assertArrayNotHasKey('signature', $manifest);

        $pass = json_decode($files['pass.json'], true);
        $this->assertSame('pass.test.dehors', $pass['passTypeIdentifier']);
        $this->assertSame('TEAM123456', $pass['teamIdentifier']);
        $this->assertSame('A-TICKET1', $pass['serialNumber']);
        $this->assertSame('A-TICKET1', $pass['barcodes'][0]['message']);
        $this->assertSame('PKBarcodeFormatQR', $pass['barcodes'][0]['format']);
        $this->assertSame('rgb(29, 111, 216)', $pass['backgroundColor']);
        $this->assertSame('Boréal', $pass['logoText']);
        $this->assertSame('Billet pour Backyard Boréal', $pass['description']);
        $this->assertSame('Backyard Boréal', $pass['eventTicket']['primaryFields'][0]['value']);
        $this->assertSame('Mont Orford', $pass['eventTicket']['secondaryFields'][1]['value']);
        $this->assertSame('Léa Tremblay 1', $pass['eventTicket']['auxiliaryFields'][0]['value']);
        $this->assertSame('Participant', $pass['eventTicket']['auxiliaryFields'][0]['label']);

        $this->assertTrue($this->signatureIsValid($files['manifest.json'], $files['signature']));
    }

    public function testSeveralTicketsComeInOneBundle(): void
    {
        $file = app(ApplePassBuilder::class)->build($this->walletOrder(tickets: 2));

        $this->assertSame(ApplePassBuilder::MIME_BUNDLE, $file->mimeType);
        $this->assertSame('backyard-boreal.pkpasses', $file->filename);

        $passes = $this->unzip($file->content);
        $this->assertSame(['backyard-boreal-1.pkpass', 'backyard-boreal-2.pkpass'], array_keys($passes));

        $serials = array_map(
            fn(string $pass) => json_decode($this->unzip($pass)['pass.json'], true)['serialNumber'],
            array_values($passes),
        );
        $this->assertSame(['A-TICKET1', 'A-TICKET2'], $serials);
    }

    private function signatureIsValid(string $manifest, string $signature): bool
    {
        $dir = sys_get_temp_dir() . '/wallet-test-' . uniqid();
        mkdir($dir);
        file_put_contents("$dir/manifest.json", $manifest);
        file_put_contents("$dir/signature", $signature);

        $valid = openssl_cms_verify(
            "$dir/manifest.json",
            OPENSSL_CMS_NOVERIFY | OPENSSL_CMS_BINARY | OPENSSL_CMS_DETACHED,
            "$dir/signer.pem",
            [],
            null,
            null,
            null,
            "$dir/signature",
            OPENSSL_ENCODING_DER,
        );
        $signer = @file_get_contents("$dir/signer.pem");
        array_map('unlink', glob("$dir/*"));
        rmdir($dir);

        return $valid === true
            && $signer
            && openssl_x509_fingerprint($signer) === openssl_x509_fingerprint($this->certificatePem);
    }
}
